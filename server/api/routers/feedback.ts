import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { feedbackItems } from "@/server/infrastructure/database/schema/feedback";
import { reworkCycles } from "@/server/infrastructure/database/schema/reworkCycles";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const feedbackTypeSchema = z.enum([
  "CREATIVE_DIRECTION",
  "COMPLIANCE",
  "BRAND_VOICE",
  "EDITING",
  "COPY",
  "TIMING",
  "TECHNICAL",
  "OTHER",
]);

const feedbackSentimentSchema = z.enum([
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "FRUSTRATED",
]);

const feedbackStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
]);

const createFeedbackInputSchema = z.object({
  deal_id: z.string().uuid(),
  deliverable_id: z.string().uuid().nullable().optional(),
  received_at: z.string().datetime({ offset: true }).nullable().optional(),
  feedback_type: feedbackTypeSchema,
  severity: z.number().int().min(1).max(10),
  sentiment: feedbackSentimentSchema.default("NEUTRAL"),
  message_raw: z.string().trim().min(1).max(10000),
  summary: z.string().trim().max(2000).nullable().optional(),
  status: feedbackStatusSchema.default("OPEN"),
  resolution_notes: z.string().trim().max(5000).nullable().optional(),
  time_spent_minutes: z.number().int().min(0).nullable().optional(),
});

const updateFeedbackInputSchema = z
  .object({
    id: z.string().uuid(),
    status: feedbackStatusSchema.optional(),
    resolution_notes: z.string().trim().max(5000).nullable().optional(),
    time_spent_minutes: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (input) =>
      input.status !== undefined ||
      input.resolution_notes !== undefined ||
      input.time_spent_minutes !== undefined,
    {
      message: "At least one update field is required",
    },
  );

const listByDealInputSchema = z.object({
  deal_id: z.string().uuid(),
});

const listByDeliverableInputSchema = z.object({
  deliverable_id: z.string().uuid(),
});

const completeReworkCycleInputSchema = z.object({
  cycle_id: z.string().uuid(),
  time_spent_minutes: z.number().int().min(0).nullable().optional(),
});

export const feedbackRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
        columns: {
          id: true,
          revisionLimit: true,
          revisionsUsed: true,
        },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      if (input.deliverable_id) {
        const deliverable = await ctx.db.query.deliverables.findFirst({
          where: and(
            eq(deliverables.id, input.deliverable_id),
            eq(deliverables.dealId, input.deal_id),
          ),
          columns: { id: true },
        });

        if (!deliverable) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deliverable not found for the provided deal",
          });
        }
      }

      return ctx.db.transaction(async (tx) => {
        const now = new Date();
        const receivedAt = input.received_at ? new Date(input.received_at) : now;

        const [createdFeedback] = await tx
          .insert(feedbackItems)
          .values({
            dealId: input.deal_id,
            deliverableId: input.deliverable_id ?? null,
            receivedAt,
            feedbackType: input.feedback_type,
            severity: input.severity,
            sentiment: input.sentiment,
            messageRaw: input.message_raw,
            summary: input.summary ?? null,
            status: input.status,
            resolutionNotes: input.resolution_notes ?? null,
            timeSpentMinutes: input.time_spent_minutes ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!createdFeedback) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create feedback",
          });
        }

        let createdReworkCycle: typeof reworkCycles.$inferSelect | null = null;
        let revisionStatus: {
          revisionLimit: number;
          revisionsUsed: number;
        } | null = null;
        let warningAlert: {
          level: "YELLOW_WARNING" | "RED_ALERT";
          title: string;
          message: string;
          shouldSuggestFeeNegotiation: boolean;
        } | null = null;

        if (input.deliverable_id) {
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(reworkCycles)
            .where(eq(reworkCycles.deliverableId, input.deliverable_id));

          const nextCycleNumber = (count ?? 0) + 1;

          const [updatedDeal] = await tx
            .update(deals)
            .set({
              revisionsUsed: sql`${deals.revisionsUsed} + 1`,
              updatedAt: now,
            })
            .where(eq(deals.id, input.deal_id))
            .returning({
              revisionLimit: deals.revisionLimit,
              revisionsUsed: deals.revisionsUsed,
            });

          if (!updatedDeal) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to update revision usage",
            });
          }

          const exceedsContractLimit =
            updatedDeal.revisionsUsed > updatedDeal.revisionLimit;

          const [cycle] = await tx
            .insert(reworkCycles)
            .values({
              deliverableId: input.deliverable_id,
              cycleNumber: nextCycleNumber,
              requestedAt: receivedAt,
              requestSummary: input.summary?.trim() || input.message_raw,
              whatChanged: null,
              clientApproved: false,
              exceedsContractLimit,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          createdReworkCycle = cycle ?? null;

          await tx
            .update(deliverables)
            .set({
              status: "IN_PROGRESS",
              updatedAt: now,
            })
            .where(eq(deliverables.id, input.deliverable_id));

          revisionStatus = {
            revisionLimit: updatedDeal.revisionLimit,
            revisionsUsed: updatedDeal.revisionsUsed,
          };

          if (updatedDeal.revisionsUsed >= updatedDeal.revisionLimit) {
            const atLimit = updatedDeal.revisionsUsed === updatedDeal.revisionLimit;
            warningAlert = {
              level: atLimit ? "YELLOW_WARNING" : "RED_ALERT",
              title: atLimit
                ? "Revision limit reached"
                : "Revision limit exceeded",
              message: atLimit
                ? `Revisions are now ${updatedDeal.revisionsUsed}/${updatedDeal.revisionLimit}. Consider negotiating an additional fee before extra revisions.`
                : `Revisions are now ${updatedDeal.revisionsUsed}/${updatedDeal.revisionLimit}. Contract limit exceeded; negotiate an additional fee.`,
              shouldSuggestFeeNegotiation: true,
            };
          }
        }

        return {
          feedback: createdFeedback,
          reworkCycle: createdReworkCycle,
          revisionStatus,
          warningAlert,
        };
      });
    }),

  update: protectedProcedure
    .input(updateFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.feedbackItems.findFirst({
        where: eq(feedbackItems.id, input.id),
        with: {
          deal: {
            columns: {
              userId: true,
            },
          },
        },
      });

      if (!existing || existing.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback not found",
        });
      }

      const [updated] = await ctx.db
        .update(feedbackItems)
        .set({
          status: input.status ?? existing.status,
          resolutionNotes:
            input.resolution_notes !== undefined
              ? input.resolution_notes
              : existing.resolutionNotes,
          timeSpentMinutes:
            input.time_spent_minutes !== undefined
              ? input.time_spent_minutes
              : existing.timeSpentMinutes,
          updatedAt: new Date(),
        })
        .where(eq(feedbackItems.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback not found",
        });
      }

      return updated;
    }),

  listByDeal: protectedProcedure
    .input(listByDealInputSchema)
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
        columns: { id: true },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      return ctx.db.query.feedbackItems.findMany({
        where: eq(feedbackItems.dealId, input.deal_id),
        orderBy: [
          desc(feedbackItems.receivedAt),
          desc(feedbackItems.createdAt),
          desc(feedbackItems.id),
        ],
      });
    }),

  listByDeliverable: protectedProcedure
    .input(listByDeliverableInputSchema)
    .query(async ({ ctx, input }) => {
      const deliverable = await ctx.db.query.deliverables.findFirst({
        where: eq(deliverables.id, input.deliverable_id),
        with: {
          deal: {
            columns: {
              userId: true,
            },
          },
        },
      });

      if (!deliverable || deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deliverable not found",
        });
      }

      const [items, [{ count }], cycles] = await Promise.all([
        ctx.db.query.feedbackItems.findMany({
          where: eq(feedbackItems.deliverableId, input.deliverable_id),
          orderBy: [
            desc(feedbackItems.receivedAt),
            desc(feedbackItems.createdAt),
            desc(feedbackItems.id),
          ],
        }),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(reworkCycles)
          .where(eq(reworkCycles.deliverableId, input.deliverable_id)),
        ctx.db.query.reworkCycles.findMany({
          where: eq(reworkCycles.deliverableId, input.deliverable_id),
          columns: {
            id: true,
            cycleNumber: true,
            requestedAt: true,
            completedAt: true,
            timeSpentMinutes: true,
            exceedsContractLimit: true,
          },
          orderBy: [desc(reworkCycles.cycleNumber)],
        }),
      ]);

      return {
        items,
        reworkCycleCount: count ?? 0,
        cycles,
      };
    }),
  completeReworkCycle: protectedProcedure
    .input(completeReworkCycleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingCycle = await ctx.db.query.reworkCycles.findFirst({
        where: eq(reworkCycles.id, input.cycle_id),
        with: {
          deliverable: {
            with: {
              deal: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!existingCycle || existingCycle.deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rework cycle not found",
        });
      }

      const [updated] = await ctx.db
        .update(reworkCycles)
        .set({
          completedAt: new Date(),
          timeSpentMinutes:
            input.time_spent_minutes !== undefined
              ? input.time_spent_minutes
              : existingCycle.timeSpentMinutes,
          updatedAt: new Date(),
        })
        .where(eq(reworkCycles.id, input.cycle_id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rework cycle not found",
        });
      }

      return updated;
    }),
  getDealRevisionStats: protectedProcedure
    .input(listByDealInputSchema)
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
        columns: { id: true },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      const [summary] = await ctx.db
        .select({
          totalRevisionTimeMinutes:
            sql<number>`coalesce(sum(${reworkCycles.timeSpentMinutes}), 0)::int`,
        })
        .from(reworkCycles)
        .innerJoin(
          deliverables,
          eq(reworkCycles.deliverableId, deliverables.id),
        )
        .where(eq(deliverables.dealId, input.deal_id));

      return {
        totalRevisionTimeMinutes: summary?.totalRevisionTimeMinutes ?? 0,
      };
    }),
});
