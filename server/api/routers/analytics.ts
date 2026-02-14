import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { calculateDeadlineState } from "@/src/server/domain/services/DeadlineCalculator";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { feedbackItems } from "@/server/infrastructure/database/schema/feedback";
import { payments } from "@/server/infrastructure/database/schema/payments";
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
        totalRevenueThisMonth: Number(paymentStats?.totalRevenueThisMonth ?? "0"),
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
});
