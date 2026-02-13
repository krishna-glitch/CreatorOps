import * as dotenv from "dotenv";
import { and, desc, eq, like, sql } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

async function main() {
  const [{ db }, { deals }] = await Promise.all([
    import("@/db"),
    import("@/server/infrastructure/database/schema/deals"),
  ]);

  const userId = "33681343-b51c-44f6-909a-70f2f74c0467";

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(
      and(eq(deals.userId, userId), like(deals.title, "Phase3 Manual Test%")),
    );

  const recent = await db
    .select({
      id: deals.id,
      title: deals.title,
      createdAt: deals.createdAt,
      brandId: deals.brandId,
    })
    .from(deals)
    .where(eq(deals.userId, userId))
    .orderBy(desc(deals.createdAt))
    .limit(5);

  console.log("phase3_manual_test_deals_count", count);
  console.log("recent_deals", recent);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
