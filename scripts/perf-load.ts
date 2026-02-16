import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL is not set");
}
const databaseUrl: string = directUrl;

type ScenarioResult = {
  name: string;
  runs: number;
  concurrency: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  avgMs: number;
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function summarizeTimings(
  name: string,
  timingsMs: number[],
  concurrency: number,
): ScenarioResult {
  const sorted = [...timingsMs].sort((a, b) => a - b);
  const minMs = sorted[0] ?? 0;
  const maxMs = sorted[sorted.length - 1] ?? 0;
  const avgMs =
    sorted.length > 0
      ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length
      : 0;

  return {
    name,
    runs: sorted.length,
    concurrency,
    minMs,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    maxMs,
    avgMs,
  };
}

async function runScenario(
  name: string,
  runs: number,
  concurrency: number,
  task: () => Promise<void>,
) {
  const timingsMs: number[] = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const runIndex = nextIndex;
      nextIndex += 1;

      if (runIndex >= runs) {
        return;
      }

      const started = performance.now();
      await task();
      timingsMs.push(performance.now() - started);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return summarizeTimings(name, timingsMs, concurrency);
}

function printScenario(result: ScenarioResult) {
  console.log(
    `${result.name.padEnd(34)} runs=${String(result.runs).padEnd(4)} p50=${result.p50Ms.toFixed(2)}ms p95=${result.p95Ms.toFixed(2)}ms avg=${result.avgMs.toFixed(2)}ms`,
  );
}

async function main() {
  const runsArg = Number(process.argv[2] ?? "60");
  const concurrencyArg = Number(process.argv[3] ?? "6");
  const runs =
    Number.isFinite(runsArg) && runsArg > 0 ? Math.floor(runsArg) : 60;
  const concurrency =
    Number.isFinite(concurrencyArg) && concurrencyArg > 0
      ? Math.floor(concurrencyArg)
      : 6;

  const sql = postgres(databaseUrl, { max: Math.max(concurrency + 2, 8) });

  try {
    const topUsers = await sql<Array<{ user_id: string; deal_count: number }>>`
      select d.user_id, count(*)::int as deal_count
      from deals d
      group by d.user_id
      order by count(*) desc
      limit 1
    `;

    if (topUsers.length === 0) {
      throw new Error(
        "No data available. Seed deals before running perf tests.",
      );
    }

    const targetUserId = topUsers[0].user_id;
    const targetDealCount = topUsers[0].deal_count;
    const cursorRow = await sql<Array<{ created_at: string; id: string }>>`
      select d.created_at::text as created_at, d.id
      from deals d
      where d.user_id = ${targetUserId}
      order by d.created_at desc, d.id desc
      offset 20
      limit 1
    `;
    const cursor = cursorRow[0] ?? null;

    console.log(
      `Benchmark user=${targetUserId} deals=${targetDealCount} runs=${runs} concurrency=${concurrency}`,
    );

    const scenarioResults: ScenarioResult[] = [];

    scenarioResults.push(
      await runScenario(
        "deals.list initial page",
        runs,
        concurrency,
        async () => {
          await sql`
            select d.id, d.created_at, d.status, d.title, b.name as brand_name
            from deals d
            join brands b on b.id = d.brand_id
            where d.user_id = ${targetUserId}
            order by d.created_at desc, d.id desc
            limit 21
          `;
        },
      ),
    );

    if (cursor) {
      scenarioResults.push(
        await runScenario(
          "deals.list next page",
          runs,
          concurrency,
          async () => {
            await sql`
              select d.id, d.created_at, d.status, d.title
              from deals d
              where d.user_id = ${targetUserId}
                and (
                  d.created_at < ${cursor.created_at}::timestamp
                  or (
                    d.created_at >= ${cursor.created_at}::timestamp
                    and d.created_at < (${cursor.created_at}::timestamp + interval '1 millisecond')
                    and d.id < ${cursor.id}::uuid
                  )
                )
              order by d.created_at desc, d.id desc
              limit 21
            `;
          },
        ),
      );
    }

    scenarioResults.push(
      await runScenario(
        "analytics dashboard rollup",
        runs,
        concurrency,
        async () => {
          await sql`
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
                    when p.paid_at is null
                      and p.status in ('EXPECTED', 'OVERDUE')
                    then p.amount
                    else 0
                  end
                ),
                0
              ) as total_outstanding_payments
            from payments p
            join deals d on d.id = p.deal_id
            where d.user_id = ${targetUserId}
          `;
        },
      ),
    );

    scenarioResults.push(
      await runScenario(
        "analytics revenue by platform",
        runs,
        concurrency,
        async () => {
          await sql`
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
            where d.user_id = ${targetUserId}
              and p.status = 'PAID'
              and p.paid_at >= date_trunc('month', now()) - interval '12 months'
              and p.paid_at < date_trunc('month', now()) + interval '1 month'
            group by coalesce(platform_by_deal.platform, 'UNSPECIFIED')
            order by sum(p.amount) desc
          `;
        },
      ),
    );

    console.log("\nResults:");
    for (const result of scenarioResults) {
      printScenario(result);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      user: {
        id: targetUserId,
        deals: targetDealCount,
      },
      config: {
        runs,
        concurrency,
      },
      scenarios: scenarioResults,
    };

    const reportPath = "summary_docs/perf-load-report.json";
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nSaved report: ${reportPath}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
