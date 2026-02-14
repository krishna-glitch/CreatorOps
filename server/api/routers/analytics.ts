import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { exclusivityRules } from "@/server/infrastructure/database/schema/exclusivity";
import { feedbackItems } from "@/server/infrastructure/database/schema/feedback";
import { payments } from "@/server/infrastructure/database/schema/payments";
import { reworkCycles } from "@/server/infrastructure/database/schema/reworkCycles";
import { calculateDeadlineState } from "@/src/server/domain/services/DeadlineCalculator";
import { generateInsights } from "@/src/server/domain/services/InsightsGenerator";
import { generateRecommendations } from "@/src/server/domain/services/RecommendationsGenerator";
import { createTRPCRouter, protectedProcedure } from "../trpc";

function getMonthWindow(reference: Date) {
  const start = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  return { start, end };
}

const advancedAnalyticsInputSchema = z
  .object({
    start_date: z.string().datetime({ offset: true }).optional(),
    end_date: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (input) =>
      !input.start_date ||
      !input.end_date ||
      new Date(input.start_date).getTime() < new Date(input.end_date).getTime(),
    {
      message: "start_date must be earlier than end_date",
      path: ["end_date"],
    },
  );

const WON_STATUSES = ["AGREED", "PAID"] as const;
const LOST_STATUSES = ["LOST", "DECLINED", "CANCELLED"] as const;

function getDefaultAdvancedAnalyticsRange(reference: Date) {
  const { start: monthStart, end: nextMonthStart } = getMonthWindow(reference);
  const start = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 11,
    1,
    0,
    0,
    0,
    0,
  );

  return {
    start,
    end: nextMonthStart,
  };
}

function resolveAdvancedAnalyticsRange(input: {
  start_date?: string;
  end_date?: string;
}) {
  const now = new Date();
  const defaults = getDefaultAdvancedAnalyticsRange(now);
  const start = input.start_date ? new Date(input.start_date) : defaults.start;
  const end = input.end_date ? new Date(input.end_date) : defaults.end;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid date range",
    });
  }

  if (start >= end) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "start_date must be earlier than end_date",
    });
  }

  return { start, end };
}

function buildMonthBuckets(start: Date, end: Date) {
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  const buckets: Array<{ monthKey: string; label: string }> = [];

  while (cursor <= endMonth) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(cursor);

    buckets.push({ monthKey, label });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function getQuarterWindow(reference: Date) {
  const quarterStartMonth = Math.floor(reference.getMonth() / 3) * 3;
  const start = new Date(
    reference.getFullYear(),
    quarterStartMonth,
    1,
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    reference.getFullYear(),
    quarterStartMonth + 3,
    1,
    0,
    0,
    0,
    0,
  );

  return { start, end };
}

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { start: monthStart, end: nextMonthStart } = getMonthWindow(now);
    const sixMonthStart = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() - 5,
      1,
      0,
      0,
      0,
      0,
    );
    const emptyRevenueTrend = Array.from({ length: 6 }).map((_, index) => {
      const offset = 5 - index;
      const monthDate = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() - offset,
        1,
      );
      const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        monthDate,
      );

      return {
        month,
        revenue: 0,
      };
    });

    try {
      const [
        [paymentStats],
        [deliverableStats],
        upcomingDeliverables,
        recentDeals,
        revenueByMonthRaw,
      ] = await Promise.all([
        ctx.db
          .select({
            totalRevenueThisMonth: sql<string>`
              coalesce(
                sum(
                  case
                    when ${payments.status} = 'PAID'
                      and ${payments.paidAt} >= ${monthStart}
                      and ${payments.paidAt} < ${nextMonthStart}
                    then ${payments.amount}
                    else 0
                  end
                ),
                0
              )
            `,
            totalOutstandingPayments: sql<string>`
              coalesce(
                sum(
                  case
                    when ${payments.paidAt} is null
                      and ${payments.status} in ('EXPECTED', 'OVERDUE')
                    then ${payments.amount}
                    else 0
                  end
                ),
                0
              )
            `,
            overduePaymentsCount: sql<number>`
              coalesce(
                sum(
                  case
                    when ${payments.paidAt} is null
                      and ${payments.expectedDate} is not null
                      and ${payments.expectedDate} < ${now}
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .where(eq(deals.userId, userId)),

        ctx.db
          .select({
            upcomingDeliverablesCount: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deliverables.scheduledAt} is not null
                      and ${deliverables.scheduledAt} >= ${now}
                      and ${deliverables.scheduledAt} < ${next7Days}
                      and ${deliverables.status} not in ('POSTED', 'CANCELLED')
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            overdueDeliverablesCount: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deliverables.scheduledAt} is not null
                      and ${deliverables.scheduledAt} < ${now}
                      and ${deliverables.postedAt} is null
                      and ${deliverables.status} <> 'CANCELLED'
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
          })
          .from(deliverables)
          .innerJoin(deals, eq(deliverables.dealId, deals.id))
          .where(eq(deals.userId, userId)),

        ctx.db
          .select({
            id: deliverables.id,
            dealId: deliverables.dealId,
            platform: deliverables.platform,
            type: deliverables.type,
            quantity: deliverables.quantity,
            scheduledAt: deliverables.scheduledAt,
            postedAt: deliverables.postedAt,
            status: deliverables.status,
            dealTitle: deals.title,
            brandName: brands.name,
          })
          .from(deliverables)
          .innerJoin(deals, eq(deliverables.dealId, deals.id))
          .innerJoin(brands, eq(deals.brandId, brands.id))
          .where(
            and(
              eq(deals.userId, userId),
              gte(deliverables.scheduledAt, now),
              lt(deliverables.scheduledAt, next7Days),
              sql`${deliverables.status} not in ('POSTED', 'CANCELLED')`,
            ),
          )
          .orderBy(asc(deliverables.scheduledAt), asc(deliverables.id))
          .limit(20),

        ctx.db
          .select({
            id: deals.id,
            title: deals.title,
            totalValue: deals.totalValue,
            currency: deals.currency,
            status: deals.status,
            createdAt: deals.createdAt,
            brandId: deals.brandId,
            brandName: brands.name,
          })
          .from(deals)
          .innerJoin(brands, eq(deals.brandId, brands.id))
          .where(eq(deals.userId, userId))
          .orderBy(desc(deals.createdAt), desc(deals.id))
          .limit(5),

        ctx.db
          .select({
            monthKey: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
            revenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.paidAt, sixMonthStart),
              lt(payments.paidAt, nextMonthStart),
            ),
          )
          .groupBy(sql`date_trunc('month', ${payments.paidAt})`)
          .orderBy(sql`date_trunc('month', ${payments.paidAt}) asc`),
      ]);

      const revenueMap = new Map(
        revenueByMonthRaw.map((row) => [row.monthKey, Number(row.revenue)]),
      );

      const revenueTrend = emptyRevenueTrend.map((entry, index) => {
        const monthDate = new Date(
          monthStart.getFullYear(),
          monthStart.getMonth() - (5 - index),
          1,
        );
        const monthKey = `${monthDate.getFullYear()}-${String(
          monthDate.getMonth() + 1,
        ).padStart(2, "0")}`;

        return {
          ...entry,
          revenue: revenueMap.get(monthKey) ?? 0,
        };
      });

      const overdueItemsCount =
        (paymentStats?.overduePaymentsCount ?? 0) +
        (deliverableStats?.overdueDeliverablesCount ?? 0);
      const upcomingDeliverablesWithDeadlines = upcomingDeliverables.map(
        (deliverable) => ({
          ...deliverable,
          ...calculateDeadlineState({
            scheduled_at: deliverable.scheduledAt,
            posted_at: deliverable.postedAt,
            now,
          }),
        }),
      );

      return {
        totalRevenueThisMonth: Number(
          paymentStats?.totalRevenueThisMonth ?? "0",
        ),
        totalOutstandingPayments: Number(
          paymentStats?.totalOutstandingPayments ?? "0",
        ),
        upcomingDeliverablesCount:
          deliverableStats?.upcomingDeliverablesCount ?? 0,
        overdueItemsCount,
        upcomingDeliverables: upcomingDeliverablesWithDeadlines,
        recentDeals,
        revenueTrend,
      };
    } catch (error) {
      console.error("[analytics] getDashboardStats fallback", {
        userId,
        error,
      });

      return {
        totalRevenueThisMonth: 0,
        totalOutstandingPayments: 0,
        upcomingDeliverablesCount: 0,
        overdueItemsCount: 0,
        upcomingDeliverables: [],
        recentDeals: [],
        revenueTrend: emptyRevenueTrend,
      };
    }
  }),
  getFeedbackInsights: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [feedbackTypeCounts, brandFeedbackStats] = await Promise.all([
      ctx.db
        .select({
          feedbackType: feedbackItems.feedbackType,
          count: sql<number>`count(*)::int`,
        })
        .from(feedbackItems)
        .innerJoin(deals, eq(feedbackItems.dealId, deals.id))
        .where(eq(deals.userId, userId))
        .groupBy(feedbackItems.feedbackType)
        .orderBy(desc(sql`count(*)`)),
      ctx.db
        .select({
          brandId: brands.id,
          brandName: brands.name,
          feedbackCount: sql<number>`count(*)::int`,
          avgSeverity: sql<number>`coalesce(avg(${feedbackItems.severity}), 0)::float`,
          highSeverityCount: sql<number>`
            coalesce(
              sum(
                case
                  when ${feedbackItems.severity} > 7 then 1
                  else 0
                end
              ),
              0
            )::int
          `,
          copyFeedbackCount: sql<number>`
            coalesce(
              sum(
                case
                  when ${feedbackItems.feedbackType} = 'COPY' then 1
                  else 0
                end
              ),
              0
            )::int
          `,
        })
        .from(feedbackItems)
        .innerJoin(deals, eq(feedbackItems.dealId, deals.id))
        .innerJoin(brands, eq(deals.brandId, brands.id))
        .where(eq(deals.userId, userId))
        .groupBy(brands.id, brands.name)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const totalFeedbackItems = feedbackTypeCounts.reduce(
      (sum, row) => sum + row.count,
      0,
    );

    const topFeedbackType = feedbackTypeCounts[0] ?? null;
    const demandingClients = brandFeedbackStats.filter(
      (row) => row.highSeverityCount > 3,
    );

    const patternInsights: string[] = [];

    for (const row of brandFeedbackStats) {
      if (row.feedbackCount <= 0) {
        continue;
      }

      const copyShare = row.copyFeedbackCount / row.feedbackCount;
      if (copyShare >= 0.5 && row.copyFeedbackCount >= 2) {
        patternInsights.push(
          `${row.brandName} often requests copy changes (${row.copyFeedbackCount}/${row.feedbackCount} feedback items).`,
        );
      }
    }

    return {
      totalFeedbackItems,
      topFeedbackType: topFeedbackType
        ? {
            feedbackType: topFeedbackType.feedbackType,
            count: topFeedbackType.count,
          }
        : null,
      feedbackTypeCounts,
      brandFeedbackStats,
      demandingClients,
      patternInsights,
    };
  }),
  getAdvancedInsights: protectedProcedure
    .input(advancedAnalyticsInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = resolveAdvancedAnalyticsRange(input ?? {});
      const analysisReference = new Date(end.getTime() - 1);
      const { start: currentQuarterStart, end: nextQuarterStart } =
        getQuarterWindow(analysisReference);
      const previousQuarterStart = new Date(
        currentQuarterStart.getFullYear(),
        currentQuarterStart.getMonth() - 3,
        1,
        0,
        0,
        0,
        0,
      );

      const platformByDeal = ctx.db
        .select({
          dealId: deliverables.dealId,
          platform: sql<string>`min(${deliverables.platform})`,
        })
        .from(deliverables)
        .groupBy(deliverables.dealId)
        .as("platform_by_deal");

      const categoryByDeal = ctx.db
        .select({
          dealId: exclusivityRules.dealId,
          category: sql<string>`min(${exclusivityRules.categoryPath})`,
        })
        .from(exclusivityRules)
        .groupBy(exclusivityRules.dealId)
        .as("category_by_deal");

      const revisionCountByDeliverable = ctx.db
        .select({
          deliverableId: reworkCycles.deliverableId,
          revisionCount: sql<number>`count(*)::int`,
        })
        .from(reworkCycles)
        .groupBy(reworkCycles.deliverableId)
        .as("revision_count_by_deliverable");

      const [
        revenueByMonthRaw,
        revenueByPlatformRaw,
        revenueByCategoryRaw,
        revenueByBrandRaw,
        [dealMetrics],
        stalledBrandFollowUpsRaw,
        wonDealValueByWeekdayRaw,
        [quarterDealSizeMetrics],
        [pipelineMetrics],
        [deliveryMetrics],
        [revisionMetrics],
        paymentDelaysByBrandRaw,
      ] = await Promise.all([
        ctx.db
          .select({
            monthKey: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
            revenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.paidAt, start),
              lt(payments.paidAt, end),
            ),
          )
          .groupBy(sql`date_trunc('month', ${payments.paidAt})`)
          .orderBy(sql`date_trunc('month', ${payments.paidAt}) asc`),

        ctx.db
          .select({
            platform: sql<string>`coalesce(${platformByDeal.platform}, 'UNSPECIFIED')`,
            revenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .leftJoin(platformByDeal, eq(platformByDeal.dealId, deals.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.paidAt, start),
              lt(payments.paidAt, end),
            ),
          )
          .groupBy(sql`coalesce(${platformByDeal.platform}, 'UNSPECIFIED')`)
          .orderBy(desc(sql`sum(${payments.amount})`)),

        ctx.db
          .select({
            category: sql<string>`coalesce(${categoryByDeal.category}, 'UNCATEGORIZED')`,
            revenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .leftJoin(categoryByDeal, eq(categoryByDeal.dealId, deals.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.paidAt, start),
              lt(payments.paidAt, end),
            ),
          )
          .groupBy(sql`coalesce(${categoryByDeal.category}, 'UNCATEGORIZED')`)
          .orderBy(desc(sql`sum(${payments.amount})`)),

        ctx.db
          .select({
            brandId: brands.id,
            brandName: brands.name,
            revenue: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .innerJoin(brands, eq(deals.brandId, brands.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.paidAt, start),
              lt(payments.paidAt, end),
            ),
          )
          .groupBy(brands.id, brands.name)
          .orderBy(desc(sql`sum(${payments.amount})`)),

        ctx.db
          .select({
            averageDealSize: sql<string>`
              coalesce(
                avg(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')
                    then ${deals.totalValue}
                    else null
                  end
                ),
                0
              )
            `,
            wonDeals: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            lostDeals: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('LOST', 'DECLINED', 'CANCELLED')
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            averageResponseTimeHours: sql<string>`
              coalesce(
                avg(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')
                      and ${deals.updatedAt} > ${deals.createdAt}
                    then extract(epoch from (${deals.updatedAt} - ${deals.createdAt})) / 3600.0
                    else null
                  end
                ),
                0
              )
            `,
          })
          .from(deals)
          .where(
            and(
              eq(deals.userId, userId),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end),
            ),
          ),

        ctx.db
          .select({
            brandName: brands.name,
            stalledDays: sql<number>`
              floor(
                extract(epoch from (${end} - max(${deals.createdAt}))) / 86400
              )::int
            `,
            openDeals: sql<number>`count(*)::int`,
          })
          .from(deals)
          .innerJoin(brands, eq(deals.brandId, brands.id))
          .where(
            and(
              eq(deals.userId, userId),
              sql`upper(coalesce(${deals.status}, '')) in ('INBOUND', 'NEGOTIATING')`,
              lt(deals.createdAt, end),
            ),
          )
          .groupBy(brands.name)
          .orderBy(desc(sql`max(${deals.createdAt})`)),

        ctx.db
          .select({
            weekday: sql<number>`extract(dow from ${deals.createdAt})::int`,
            averageValue: sql<string>`coalesce(avg(${deals.totalValue}), 0)`,
            closedDeals: sql<number>`count(*)::int`,
          })
          .from(deals)
          .where(
            and(
              eq(deals.userId, userId),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end),
              sql`upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')`,
            ),
          )
          .groupBy(sql`extract(dow from ${deals.createdAt})`)
          .orderBy(sql`extract(dow from ${deals.createdAt}) asc`),

        ctx.db
          .select({
            currentQuarterAverageDealSize: sql<string>`
              coalesce(
                avg(
                  case
                    when ${deals.createdAt} >= ${currentQuarterStart}
                      and ${deals.createdAt} < ${nextQuarterStart}
                    then ${deals.totalValue}
                    else null
                  end
                ),
                0
              )
            `,
            previousQuarterAverageDealSize: sql<string>`
              coalesce(
                avg(
                  case
                    when ${deals.createdAt} >= ${previousQuarterStart}
                      and ${deals.createdAt} < ${currentQuarterStart}
                    then ${deals.totalValue}
                    else null
                  end
                ),
                0
              )
            `,
            currentQuarterClosedDeals: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deals.createdAt} >= ${currentQuarterStart}
                      and ${deals.createdAt} < ${nextQuarterStart}
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            previousQuarterClosedDeals: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deals.createdAt} >= ${previousQuarterStart}
                      and ${deals.createdAt} < ${currentQuarterStart}
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
          })
          .from(deals)
          .where(
            and(
              eq(deals.userId, userId),
              gte(deals.createdAt, previousQuarterStart),
              lt(deals.createdAt, nextQuarterStart),
              sql`upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')`,
            ),
          ),

        ctx.db
          .select({
            inbound: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) = 'INBOUND'
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            negotiating: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) = 'NEGOTIATING'
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            won: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('AGREED', 'PAID')
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            lost: sql<number>`
              coalesce(
                sum(
                  case
                    when upper(coalesce(${deals.status}, '')) in ('LOST', 'DECLINED', 'CANCELLED')
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
          })
          .from(deals)
          .where(
            and(
              eq(deals.userId, userId),
              gte(deals.createdAt, start),
              lt(deals.createdAt, end),
            ),
          ),

        ctx.db
          .select({
            onTimeDeliveries: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deliverables.scheduledAt} is not null
                      and ${deliverables.postedAt} is not null
                      and ${deliverables.postedAt} <= ${deliverables.scheduledAt}
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            totalTrackedDeliveries: sql<number>`
              coalesce(
                sum(
                  case
                    when ${deliverables.scheduledAt} is not null
                      and ${deliverables.postedAt} is not null
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
          })
          .from(deliverables)
          .innerJoin(deals, eq(deliverables.dealId, deals.id))
          .where(
            and(
              eq(deals.userId, userId),
              gte(deliverables.scheduledAt, start),
              lt(deliverables.scheduledAt, end),
            ),
          ),

        ctx.db
          .select({
            averageRevisionCount: sql<string>`
              coalesce(
                avg(coalesce(${revisionCountByDeliverable.revisionCount}, 0)::numeric),
                0
              )
            `,
          })
          .from(deliverables)
          .innerJoin(deals, eq(deliverables.dealId, deals.id))
          .leftJoin(
            revisionCountByDeliverable,
            eq(revisionCountByDeliverable.deliverableId, deliverables.id),
          )
          .where(
            and(
              eq(deals.userId, userId),
              sql`coalesce(${deliverables.postedAt}, ${deliverables.scheduledAt}, ${deliverables.createdAt}) >= ${start}`,
              sql`coalesce(${deliverables.postedAt}, ${deliverables.scheduledAt}, ${deliverables.createdAt}) < ${end}`,
            ),
          ),

        ctx.db
          .select({
            brandId: brands.id,
            brandName: brands.name,
            averageDelayDays: sql<string>`
              coalesce(
                avg(
                  greatest(
                    extract(epoch from (${payments.paidAt} - ${payments.expectedDate})) / 86400.0,
                    0
                  )
                ),
                0
              )
            `,
            latePayments: sql<number>`
              coalesce(
                sum(
                  case
                    when ${payments.paidAt} > ${payments.expectedDate}
                    then 1
                    else 0
                  end
                ),
                0
              )::int
            `,
            totalPayments: sql<number>`count(*)::int`,
          })
          .from(payments)
          .innerJoin(deals, eq(payments.dealId, deals.id))
          .innerJoin(brands, eq(deals.brandId, brands.id))
          .where(
            and(
              eq(deals.userId, userId),
              eq(payments.status, "PAID"),
              gte(payments.expectedDate, start),
              lt(payments.expectedDate, end),
              sql`${payments.expectedDate} is not null`,
              sql`${payments.paidAt} is not null`,
            ),
          )
          .groupBy(brands.id, brands.name)
          .orderBy(
            desc(
              sql`avg(greatest(extract(epoch from (${payments.paidAt} - ${payments.expectedDate})) / 86400.0, 0))`,
            ),
          ),
      ]);

      const monthBuckets = buildMonthBuckets(
        start,
        new Date(end.getTime() - 1),
      );
      const revenueByMonthMap = new Map(
        revenueByMonthRaw.map((row) => [row.monthKey, Number(row.revenue)]),
      );

      const revenueByMonth = monthBuckets.map((bucket) => ({
        monthKey: bucket.monthKey,
        label: bucket.label,
        revenue: revenueByMonthMap.get(bucket.monthKey) ?? 0,
      }));
      const revenueByCategory = revenueByCategoryRaw.map((row) => ({
        category: row.category,
        revenue: Number(row.revenue),
      }));
      const paymentDelaysByBrand = paymentDelaysByBrandRaw.map((row) => ({
        brandId: row.brandId,
        brandName: row.brandName,
        averageDelayDays: Number(row.averageDelayDays),
        latePayments: row.latePayments,
        totalPayments: row.totalPayments,
        latePaymentRate:
          row.totalPayments > 0 ? row.latePayments / row.totalPayments : 0,
      }));
      const wonDealValueByWeekday = wonDealValueByWeekdayRaw.map((row) => ({
        weekday: row.weekday,
        averageValue: Number(row.averageValue),
        closedDeals: row.closedDeals,
      }));
      const insights = generateInsights({
        revenueByCategory,
        paymentDelaysByBrand,
        wonDealValueByWeekday,
        currentQuarterAverageDealSize: Number(
          quarterDealSizeMetrics?.currentQuarterAverageDealSize ?? "0",
        ),
        previousQuarterAverageDealSize: Number(
          quarterDealSizeMetrics?.previousQuarterAverageDealSize ?? "0",
        ),
        currentQuarterClosedDeals:
          quarterDealSizeMetrics?.currentQuarterClosedDeals ?? 0,
        previousQuarterClosedDeals:
          quarterDealSizeMetrics?.previousQuarterClosedDeals ?? 0,
      });
      const stalledBrandFollowUps = stalledBrandFollowUpsRaw
        .map((row) => ({
          brandName: row.brandName,
          stalledDays: row.stalledDays,
          openDeals: row.openDeals,
        }))
        .filter((row) => row.stalledDays >= 7)
        .sort((a, b) => b.stalledDays - a.stalledDays);
      const onTimeDeliveryRate =
        (deliveryMetrics?.totalTrackedDeliveries ?? 0) > 0
          ? (deliveryMetrics?.onTimeDeliveries ?? 0) /
            (deliveryMetrics?.totalTrackedDeliveries ?? 1)
          : 0;
      const recommendations = generateRecommendations({
        insights,
        onTimeDeliveryRate,
        paymentDelaysByBrand,
        stalledBrandFollowUps,
      });

      return {
        range: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        constants: {
          wonStatuses: WON_STATUSES,
          lostStatuses: LOST_STATUSES,
        },
        revenueByMonth,
        revenueByPlatform: revenueByPlatformRaw.map((row) => ({
          platform: row.platform,
          revenue: Number(row.revenue),
        })),
        revenueByCategory,
        revenueByBrand: revenueByBrandRaw.map((row) => ({
          brandId: row.brandId,
          brandName: row.brandName,
          revenue: Number(row.revenue),
        })),
        averageDealSize: Number(dealMetrics?.averageDealSize ?? "0"),
        dealsWonVsLost: {
          won: dealMetrics?.wonDeals ?? 0,
          lost: dealMetrics?.lostDeals ?? 0,
        },
        dealPipeline: {
          inbound: pipelineMetrics?.inbound ?? 0,
          negotiating: pipelineMetrics?.negotiating ?? 0,
          won: pipelineMetrics?.won ?? 0,
          lost: pipelineMetrics?.lost ?? 0,
        },
        averageResponseTimeHours: Number(
          dealMetrics?.averageResponseTimeHours ?? "0",
        ),
        onTimeDeliveryRate,
        onTimeDeliveries: deliveryMetrics?.onTimeDeliveries ?? 0,
        totalTrackedDeliveries: deliveryMetrics?.totalTrackedDeliveries ?? 0,
        averageRevisionCount: Number(
          revisionMetrics?.averageRevisionCount ?? "0",
        ),
        paymentDelaysByBrand,
        insights,
        recommendations,
      };
    }),
});
