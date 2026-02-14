import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
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

    const revenueTrend = Array.from({ length: 6 }).map((_, index) => {
      const offset = 5 - index;
      const monthDate = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() - offset,
        1,
      );
      const monthKey = `${monthDate.getFullYear()}-${String(
        monthDate.getMonth() + 1,
      ).padStart(2, "0")}`;
      const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        monthDate,
      );

      return {
        month,
        revenue: revenueMap.get(monthKey) ?? 0,
      };
    });

    const overdueItemsCount =
      (paymentStats?.overduePaymentsCount ?? 0) +
      (deliverableStats?.overdueDeliverablesCount ?? 0);

    return {
      totalRevenueThisMonth: Number(paymentStats?.totalRevenueThisMonth ?? "0"),
      totalOutstandingPayments: Number(
        paymentStats?.totalOutstandingPayments ?? "0",
      ),
      upcomingDeliverablesCount: deliverableStats?.upcomingDeliverablesCount ?? 0,
      overdueItemsCount,
      upcomingDeliverables,
      recentDeals,
      revenueTrend,
    };
  }),
});
