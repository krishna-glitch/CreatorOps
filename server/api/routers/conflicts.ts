import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { conflicts } from "@/server/infrastructure/database/schema/exclusivity";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const listConflictsInputSchema = z
  .object({
    status: z.enum(["ACTIVE", "RESOLVED", "ALL"]).default("ACTIVE"),
  })
  .optional();

const markResolvedInputSchema = z.object({
  id: z.string().uuid(),
});

type ConflictListItem = {
  id: string;
  type: "EXCLUSIVITY" | "REVISION_LIMIT" | "APPROVAL_SLA" | "PAYMENT_DISPUTE";
  severity: "WARN" | "BLOCK";
  overlap: Record<string, unknown>;
  suggested_resolutions: string[];
  auto_resolved: boolean;
  target_deal_id: string | null;
  target_deal_title: string | null;
  target_brand_name: string | null;
  target_deliverable_id: string | null;
  conflicting_rule_id: string | null;
  conflicting_rule_deal_id: string | null;
  conflicting_rule_deal_title: string | null;
  conflicting_rule_brand_name: string | null;
};

export const conflictsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listConflictsInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const status = input?.status ?? "ACTIVE";
        const rows = await ctx.db.query.conflicts.findMany({
          with: {
            conflictingRule: {
              with: {
                deal: {
                  columns: {
                    id: true,
                    userId: true,
                    title: true,
                  },
                  with: {
                    brand: {
                      columns: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const [relatedDeals, relatedDeliverables] = await Promise.all([
          ctx.db.query.deals.findMany({
            where: eq(deals.userId, ctx.user.id),
            columns: {
              id: true,
              title: true,
              userId: true,
            },
            with: {
              brand: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          }),
          ctx.db.query.deliverables.findMany({
            columns: {
              id: true,
              dealId: true,
            },
            with: {
              deal: {
                columns: {
                  id: true,
                  userId: true,
                  title: true,
                },
                with: {
                  brand: {
                    columns: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

        const dealMap = new Map(relatedDeals.map((deal) => [deal.id, deal]));
        const deliverableMap = new Map(
          relatedDeliverables
            .filter((item) => item.deal.userId === ctx.user.id)
            .map((item) => [item.id, item]),
        );

        const result: ConflictListItem[] = rows
          .filter((row) => {
            if (status === "ACTIVE" && row.autoResolved) {
              return false;
            }
            if (status === "RESOLVED" && !row.autoResolved) {
              return false;
            }

            const ruleDeal = row.conflictingRule?.deal;
            if (ruleDeal?.userId === ctx.user.id) {
              return true;
            }

            const maybeDeal = dealMap.get(row.newDealOrDeliverableId);
            if (maybeDeal?.userId === ctx.user.id) {
              return true;
            }

            const maybeDeliverable = deliverableMap.get(
              row.newDealOrDeliverableId,
            );
            return maybeDeliverable?.deal.userId === ctx.user.id;
          })
          .map((row) => {
            const maybeDeal = dealMap.get(row.newDealOrDeliverableId);
            const maybeDeliverable = deliverableMap.get(
              row.newDealOrDeliverableId,
            );
            const targetDeal = maybeDeal ?? maybeDeliverable?.deal ?? null;

            return {
              id: row.id,
              type: row.type,
              severity: row.severity,
              overlap: (row.overlap as Record<string, unknown>) ?? {},
              suggested_resolutions: row.suggestedResolutions,
              auto_resolved: row.autoResolved,
              target_deal_id: targetDeal?.id ?? null,
              target_deal_title: targetDeal?.title ?? null,
              target_brand_name: targetDeal?.brand?.name ?? null,
              target_deliverable_id: maybeDeliverable?.id ?? null,
              conflicting_rule_id: row.conflictingRuleId ?? null,
              conflicting_rule_deal_id: row.conflictingRule?.deal?.id ?? null,
              conflicting_rule_deal_title:
                row.conflictingRule?.deal?.title ?? null,
              conflicting_rule_brand_name:
                row.conflictingRule?.deal?.brand?.name ?? null,
            };
          });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database error while loading conflicts.",
          cause: error,
        });
      }
    }),
  markResolved: protectedProcedure
    .input(markResolvedInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.conflicts.findFirst({
        where: eq(conflicts.id, input.id),
        with: {
          conflictingRule: {
            with: {
              deal: {
                columns: {
                  id: true,
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conflict not found",
        });
      }

      const relatedDeal = await ctx.db.query.deals.findFirst({
        where: eq(deals.id, existing.newDealOrDeliverableId),
        columns: {
          id: true,
          userId: true,
        },
      });

      const relatedDeliverable = await ctx.db.query.deliverables.findFirst({
        where: eq(deliverables.id, existing.newDealOrDeliverableId),
        with: {
          deal: {
            columns: {
              id: true,
              userId: true,
            },
          },
        },
      });

      const isOwnedByUser =
        existing.conflictingRule?.deal?.userId === ctx.user.id ||
        relatedDeal?.userId === ctx.user.id ||
        relatedDeliverable?.deal.userId === ctx.user.id;

      if (!isOwnedByUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conflict not found",
        });
      }

      const [updated] = await ctx.db
        .update(conflicts)
        .set({
          autoResolved: true,
        })
        .where(eq(conflicts.id, input.id))
        .returning({
          id: conflicts.id,
          autoResolved: conflicts.autoResolved,
        });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not update conflict",
        });
      }

      return updated;
    }),
  summary: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.conflicts.findMany({
      with: {
        conflictingRule: {
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

    const [relatedDeals, relatedDeliverables] = await Promise.all([
      ctx.db.query.deals.findMany({
        where: eq(deals.userId, ctx.user.id),
        columns: {
          id: true,
          userId: true,
        },
      }),
      ctx.db.query.deliverables.findMany({
        columns: {
          id: true,
        },
        with: {
          deal: {
            columns: {
              userId: true,
            },
          },
        },
      }),
    ]);

    const dealIds = new Set(relatedDeals.map((deal) => deal.id));
    const deliverableIds = new Set(
      relatedDeliverables
        .filter((deliverable) => deliverable.deal.userId === ctx.user.id)
        .map((deliverable) => deliverable.id),
    );

    const activeCount = rows.filter((row) => {
      if (row.autoResolved) {
        return false;
      }

      if (row.conflictingRule?.deal?.userId === ctx.user.id) {
        return true;
      }

      return (
        dealIds.has(row.newDealOrDeliverableId) ||
        deliverableIds.has(row.newDealOrDeliverableId)
      );
    }).length;

    return { activeCount };
  }),
});
