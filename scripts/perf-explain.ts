import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error("DIRECT_URL is not set");
}
const databaseUrl: string = directUrl;

type ExplainRow = {
  "QUERY PLAN": string;
};

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function explain(sqlClient: postgres.Sql, label: string, query: string) {
  printSection(label);
  const rows = await sqlClient.unsafe<ExplainRow[]>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${query}`,
  );
  for (const row of rows) {
    console.log(row["QUERY PLAN"]);
  }
}

async function main() {
  const sqlClient = postgres(databaseUrl, { max: 1 });

  try {
    const topUsers = await sqlClient<
      Array<{ user_id: string; deal_count: number }>
    >`
      select d.user_id, count(*)::int as deal_count
      from deals d
      group by d.user_id
      order by count(*) desc
      limit 1
    `;

    if (topUsers.length === 0) {
      console.log("No deal data found; skipping EXPLAIN.");
      return;
    }

    const targetUserId = topUsers[0].user_id;
    const targetDealCount = topUsers[0].deal_count;
    console.log(`Target user: ${targetUserId} (${targetDealCount} deals)`);

    await explain(
      sqlClient,
      "deals.list initial page",
      `
      select d.id, d.created_at, d.status, d.title, d.total_value, d.currency, b.name as brand_name
      from deals d
      join brands b on b.id = d.brand_id
      where d.user_id = '${targetUserId}'
      order by d.created_at desc, d.id desc
      limit 21
      `,
    );

    const cursorRow = await sqlClient<
      Array<{ created_at: string; id: string }>
    >`
      select d.created_at::text as created_at, d.id
      from deals d
      where d.user_id = ${targetUserId}
      order by d.created_at desc, d.id desc
      offset 20
      limit 1
    `;

    if (cursorRow[0]) {
      const cursor = cursorRow[0];
      await explain(
        sqlClient,
        "deals.list next page",
        `
        select d.id, d.created_at, d.status, d.title
        from deals d
        where d.user_id = '${targetUserId}'
          and (
            d.created_at < '${cursor.created_at}'::timestamp
            or (
              d.created_at >= '${cursor.created_at}'::timestamp
              and d.created_at < ('${cursor.created_at}'::timestamp + interval '1 millisecond')
              and d.id < '${cursor.id}'::uuid
            )
          )
        order by d.created_at desc, d.id desc
        limit 21
        `,
      );
    } else {
      console.log("Not enough rows for cursor-page EXPLAIN.");
    }

    await explain(
      sqlClient,
      "getDashboardStats payment rollup",
      `
      select
        coalesce(
          sum(
            case
              when p.status = 'PAID'
                and p.paid_at >= date_trunc('month', now())
                and p.paid_at < date_trunc('month', now()) + interval '1 month'
              then p.amount
              else 0
            end
          ),
          0
        ) as total_revenue_this_month,
        coalesce(
          sum(
            case
              when p.paid_at is null and p.status in ('EXPECTED', 'OVERDUE')
              then p.amount
              else 0
            end
          ),
          0
        ) as total_outstanding_payments
      from payments p
      join deals d on d.id = p.deal_id
      where d.user_id = '${targetUserId}'
      `,
    );

    await explain(
      sqlClient,
      "advancedInsights revenue by platform",
      `
      select
        coalesce(platform_by_deal.platform, 'UNSPECIFIED') as platform,
        coalesce(sum(p.amount), 0) as revenue
      from payments p
      join deals d on d.id = p.deal_id
      left join (
        select
          dl.deal_id,
          coalesce(min(dl.platform), 'UNSPECIFIED') as platform
        from deliverables dl
        group by dl.deal_id
      ) as platform_by_deal on platform_by_deal.deal_id = p.deal_id
      where d.user_id = '${targetUserId}'
        and p.status = 'PAID'
        and p.paid_at >= date_trunc('month', now()) - interval '12 months'
        and p.paid_at < date_trunc('month', now()) + interval '1 month'
      group by coalesce(platform_by_deal.platform, 'UNSPECIFIED')
      order by sum(p.amount) desc
      `,
    );
  } finally {
    await sqlClient.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
