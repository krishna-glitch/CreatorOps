import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { conflicts } from "@/server/infrastructure/database/schema/exclusivity";
import { reminders } from "@/server/infrastructure/database/schema/reminders";
import {
  type Conflict,
  detectExclusivityConflicts,
} from "@/src/server/domain/services/ConflictDetector";
import { calculateDeadlineState } from "@/src/server/domain/services/DeadlineCalculator";
import { syncDeliverableReminders } from "@/src/server/domain/services/ReminderSync";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const deliverablePlatformSchema = z.enum([
  "INSTAGRAM",
  "YOUTUBE",
  "TIKTOK",
  "OTHER",
]);

const deliverableTypeSchema = z.enum([
  "REEL",
  "POST",
  "STORY",
  "SHORT",
  "VIDEO",
  "OTHER",
]);

const deliverableStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "POSTED",
  "CANCELLED",
]);

const createDeliverableInputSchema = z.object({
  deal_id: z.string().uuid(),
  deliverable_id: z.string().uuid().optional(),
  conflict_session_id: z.string().uuid().optional(),
  acknowledge_conflicts: z.boolean().default(false),
  category_path: z.string().trim().min(1).max(200).optional(),
  platform: deliverablePlatformSchema,
  type: deliverableTypeSchema,
  quantity: z.number().int().positive().default(1),
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  posted_at: z.string().datetime({ offset: true }).nullable().optional(),
  status: deliverableStatusSchema.default("DRAFT"),
});

const updateDeliverableInputSchema = z
  .object({
    id: z.string().uuid(),
    platform: deliverablePlatformSchema.optional(),
    type: deliverableTypeSchema.optional(),
    quantity: z.number().int().positive().optional(),
    scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
    posted_at: z.string().datetime({ offset: true }).nullable().optional(),
    status: deliverableStatusSchema.optional(),
  })
  .refine(
    (input) =>
      input.platform !== undefined ||
      input.type !== undefined ||
      input.quantity !== undefined ||
      input.scheduled_at !== undefined ||
      input.posted_at !== undefined ||
      input.status !== undefined,
    { message: "At least one field must be provided for update" },
  );

const deleteDeliverableInputSchema = z.object({
  id: z.string().uuid(),
});

const listByDealInputSchema = z.object({
  deal_id: z.string().uuid(),
});

const detectorPlatformSchema = z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"]);

export const deliverablesRouter = createTRPCRouter({
  listByDeal: protectedProcedure
    .input(listByDealInputSchema)
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
        columns: {
          id: true,
        },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      const records = await ctx.db.query.deliverables.findMany({
        where: eq(deliverables.dealId, input.deal_id),
        orderBy: [desc(deliverables.createdAt), desc(deliverables.id)],
      });

      const now = new Date();
      return records.map((record) => ({
        ...record,
        ...calculateDeadlineState({
          scheduled_at: record.scheduledAt,
          posted_at: record.postedAt,
          now,
        }),
      }));
    }),

  create: protectedProcedure
    .input(createDeliverableInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deal = await ctx.db.query.deals.findFirst({
          where: and(
            eq(deals.id, input.deal_id),
            eq(deals.userId, ctx.user.id),
          ),
          columns: {
            id: true,
          },
        });

        if (!deal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        const deliverableId = input.deliverable_id ?? randomUUID();
        const scheduledAt = input.scheduled_at
          ? new Date(input.scheduled_at)
          : null;
        const deliverablePlatform = detectorPlatformSchema.safeParse(
          input.platform,
        );
        const userRules = await ctx.db.query.exclusivityRules.findMany({
          with: {
            deal: {
              columns: {
                id: true,
                userId: true,
              },
            },
          },
        });

        const applicableRules = userRules
          .filter(
            (rule) =>
              rule.deal.userId === ctx.user.id && rule.dealId !== input.deal_id,
          )
          .map((rule) => ({
            id: rule.id,
            deal_id: rule.dealId,
            category_path: rule.categoryPath,
            scope: rule.scope,
            start_date: rule.startDate,
            end_date: rule.endDate,
            platforms: rule.platforms,
            regions: rule.regions,
            notes: rule.notes,
          }));

        const detectedConflicts =
          deliverablePlatform.success && scheduledAt
            ? detectExclusivityConflicts(
                {
                  id: deliverableId,
                  category: input.category_path ?? null,
                  platform: deliverablePlatform.data,
                  scheduled_at: scheduledAt,
                },
                applicableRules,
              )
            : [];

        if (detectedConflicts.length > 0) {
          const conflictEventTime = new Date().toISOString();
          await ctx.db.insert(conflicts).values(
            detectedConflicts.map((conflict) => ({
              type: conflict.type,
              newDealOrDeliverableId: deliverableId,
              conflictingRuleId: conflict.conflicting_rule_id,
              overlap: {
                ...conflict.overlap,
                conflict_session_id: input.conflict_session_id ?? null,
                proceeded_despite_conflict: input.acknowledge_conflicts,
                acknowledged_by_user_id: input.acknowledge_conflicts
                  ? ctx.user.id
                  : null,
                detected_at: conflictEventTime,
              },
              severity: conflict.severity,
              suggestedResolutions: conflict.suggested_resolutions,
              autoResolved: input.acknowledge_conflicts,
            })),
          );
        }

        if (detectedConflicts.length > 0 && !input.acknowledge_conflicts) {
          return {
            created: null as null,
            conflicts: detectedConflicts as Conflict[],
            requires_acknowledgement: true as const,
            proceeded_despite_conflict: false as const,
          };
        }

        const [created] = await ctx.db
          .insert(deliverables)
          .values({
            id: deliverableId,
            dealId: input.deal_id,
            platform: input.platform,
            type: input.type,
            quantity: input.quantity,
            scheduledAt,
            postedAt: input.posted_at ? new Date(input.posted_at) : null,
            status: input.status,
          })
          .returning();

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create deliverable",
          });
        }

        await syncDeliverableReminders({
          db: ctx.db as any,
          deliverable: {
            id: created.id,
            dealId: created.dealId,
            scheduledAt: created.scheduledAt,
            postedAt: created.postedAt,
            status: created.status,
          },
        });

        return {
          created,
          conflicts: detectedConflicts as Conflict[],
          requires_acknowledgement: false as const,
          proceeded_despite_conflict:
            detectedConflicts.length > 0 && input.acknowledge_conflicts,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create deliverable",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(updateDeliverableInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.deliverables.findFirst({
          where: eq(deliverables.id, input.id),
          with: {
            deal: {
              columns: {
                id: true,
                userId: true,
              },
            },
          },
        });

        if (!existing || existing.deal.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deliverable not found",
          });
        }

        const updateData: {
          platform?: z.infer<typeof deliverablePlatformSchema>;
          type?: z.infer<typeof deliverableTypeSchema>;
          quantity?: number;
          scheduledAt?: Date | null;
          postedAt?: Date | null;
          status?: z.infer<typeof deliverableStatusSchema>;
          updatedAt: Date;
        } = {
          updatedAt: new Date(),
        };

        if (input.platform !== undefined) {
          updateData.platform = input.platform;
        }
        if (input.type !== undefined) {
          updateData.type = input.type;
        }
        if (input.quantity !== undefined) {
          updateData.quantity = input.quantity;
        }
        if (input.scheduled_at !== undefined) {
          updateData.scheduledAt = input.scheduled_at
            ? new Date(input.scheduled_at)
            : null;
        }
        if (input.posted_at !== undefined) {
          updateData.postedAt = input.posted_at
            ? new Date(input.posted_at)
            : null;
        }
        if (input.status !== undefined) {
          updateData.status = input.status;
        }

        const [updated] = await ctx.db
          .update(deliverables)
          .set(updateData)
          .where(eq(deliverables.id, input.id))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deliverable not found",
          });
        }

        await syncDeliverableReminders({
          db: ctx.db as any,
          deliverable: {
            id: updated.id,
            dealId: updated.dealId,
            scheduledAt: updated.scheduledAt,
            postedAt: updated.postedAt,
            status: updated.status,
          },
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not update deliverable",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(deleteDeliverableInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.deliverables.findFirst({
          where: eq(deliverables.id, input.id),
          with: {
            deal: {
              columns: {
                id: true,
                userId: true,
              },
            },
          },
        });

        if (!existing || existing.deal.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deliverable not found",
          });
        }

        await ctx.db
          .update(reminders)
          .set({
            status: "CANCELLED",
            updatedAt: new Date(),
          })
          .where(eq(reminders.deliverableId, input.id));

        const [deletedDeliverable] = await ctx.db
          .delete(deliverables)
          .where(eq(deliverables.id, input.id))
          .returning({
            id: deliverables.id,
          });

        if (!deletedDeliverable) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deliverable not found",
          });
        }

        return deletedDeliverable;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete deliverable",
          cause: error,
        });
      }
    }),
});
