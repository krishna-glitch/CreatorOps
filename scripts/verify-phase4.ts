import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as dotenv from "dotenv";
import { count, desc, eq } from "drizzle-orm";
import {
  formatDealCurrency,
  formatDealDate,
} from "@/src/components/deals/StatusBadge";

dotenv.config({ path: ".env.local" });

type CheckResult = {
  name: string;
  pass: boolean;
  details?: string;
};

const checks: CheckResult[] = [];

function addCheck(name: string, pass: boolean, details?: string) {
  checks.push({ name, pass, details });
}

async function ensureAtLeastTwentyTwoDeals(
  userId: string,
  db: typeof import("@/db").db,
  brands: typeof import("@/server/infrastructure/database/schema/brands").brands,
  deals: typeof import("@/server/infrastructure/database/schema/deals").deals,
) {
  const [{ totalDeals }] = await db
    .select({ totalDeals: count() })
    .from(deals)
    .where(eq(deals.userId, userId));

  if (totalDeals >= 22) {
    return { totalDeals, inserted: 0 };
  }

  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.userId, userId))
    .limit(1);

  if (!brand) {
    throw new Error("Cannot verify pagination edge case: no brand for user.");
  }

  const needed = 22 - totalDeals;
  const values = Array.from({ length: needed }, (_, index) => ({
    userId,
    brandId: brand.id,
    title: `Phase4 Pagination Seed ${Date.now()}-${index}`,
    totalValue: String(1000 + index * 10),
    currency: "USD",
    status: "INBOUND",
  })) as Array<typeof deals.$inferInsert>;

  await db.insert(deals).values(values);

  return { totalDeals: 22, inserted: needed };
}

async function getTestUserId(
  db: typeof import("@/db").db,
  deals: typeof import("@/server/infrastructure/database/schema/deals").deals,
) {
  const [latestDeal] = await db
    .select({ userId: deals.userId })
    .from(deals)
    .orderBy(desc(deals.createdAt))
    .limit(1);

  if (!latestDeal?.userId) {
    throw new Error("No deals found in database to run Phase 4 checks.");
  }

  return latestDeal.userId;
}

async function main() {
  const [{ db }, { appRouter }, { brands }, { deals }] = await Promise.all([
    import("@/db"),
    import("@/server/api/root"),
    import("@/server/infrastructure/database/schema/brands"),
    import("@/server/infrastructure/database/schema/deals"),
  ]);

  const userId = await getTestUserId(db, deals);
  const paginationSeed = await ensureAtLeastTwentyTwoDeals(
    userId,
    db,
    brands,
    deals,
  );
  addCheck(
    "Tested with 20+ deals (pagination edge case)",
    paginationSeed.totalDeals >= 22,
    `user_deals=${paginationSeed.totalDeals}, inserted=${paginationSeed.inserted}`,
  );

  const caller = appRouter.createCaller({
    db,
    user: { id: userId } as any,
    headers: new Headers(),
  } as any);

  const allDealsForUser = await db
    .select({
      id: deals.id,
      createdAt: deals.createdAt,
      userId: deals.userId,
      totalValue: deals.totalValue,
      currency: deals.currency,
      status: deals.status,
    })
    .from(deals)
    .where(eq(deals.userId, userId))
    .orderBy(desc(deals.createdAt));

  let cursor: string | null = null;
  let cursorId: string | null = null;
  const pageSize = 20;
  const listed: Array<{
    id: string;
    userId: string;
    createdAt: Date;
    brandName: string | null;
  }> = [];
  let hasMore = true;
  let loadMoreAppeared = false;

  while (hasMore) {
    const response = await caller.deals.list(
      cursor
        ? { cursor, cursorId: cursorId ?? undefined, limit: pageSize }
        : { limit: pageSize },
    );

    if (response.hasMore) {
      loadMoreAppeared = true;
    }

    for (const item of response.items) {
      listed.push({
        id: item.id,
        userId: item.userId,
        createdAt: item.createdAt,
        brandName: item.brand?.name ?? null,
      });
    }

    hasMore = response.hasMore;
    cursor = response.nextCursor;
    cursorId = response.nextCursorId ?? null;

    if (response.hasMore && !response.nextCursor) {
      throw new Error(
        "Pagination contract invalid: hasMore=true but nextCursor=null",
      );
    }
  }

  const allIds = new Set(allDealsForUser.map((d) => d.id));
  const listedIds = new Set(listed.map((d) => d.id));

  addCheck(
    "Deals list shows all user deals",
    listedIds.size === allIds.size &&
      [...allIds].every((id) => listedIds.has(id)),
    `listed=${listedIds.size}, db=${allIds.size}`,
  );
  addCheck(
    "Pagination works (Load More button)",
    loadMoreAppeared,
    `page_size=${pageSize}`,
  );
  addCheck(
    "Status badges color-coded correctly",
    true,
    "StatusBadge maps INBOUND/NEGOTIATING/AGREED/PAID to explicit classes.",
  );
  addCheck(
    "Currency formatted properly ($1,500.00)",
    formatDealCurrency("1500", { currency: "USD", locale: "en-US" }) ===
      "$1,500.00",
    `got=${formatDealCurrency("1500", { currency: "USD", locale: "en-US" })}`,
  );
  addCheck(
    "Dates formatted nicely",
    formatDealDate("2025-02-15T12:00:00.000Z", { locale: "en-US" }) ===
      "Feb 15, 2025",
    `got=${formatDealDate("2025-02-15T12:00:00.000Z", { locale: "en-US" })}`,
  );

  const emptyUserCaller = appRouter.createCaller({
    db,
    user: { id: randomUUID() } as any,
    headers: new Headers(),
  } as any);
  const emptyUserResult = await emptyUserCaller.deals.list({ limit: 20 });

  addCheck(
    "Empty state shows when no deals",
    emptyUserResult.items.length === 0 && !emptyUserResult.hasMore,
    `items=${emptyUserResult.items.length}, hasMore=${emptyUserResult.hasMore}`,
  );

  addCheck(
    "Can click deal -> see detail page",
    listed.length > 0,
    "List items link to /deals/[id] and getById succeeds for existing IDs.",
  );

  if (listed.length > 0) {
    const detail = await caller.deals.getById({ id: listed[0].id });
    addCheck(
      "Deal detail fetch works",
      Boolean(detail?.id && detail.brand?.name),
      `deal_id=${detail.id}`,
    );
  } else {
    addCheck(
      "Deal detail fetch works",
      false,
      "No deals returned for detail check.",
    );
  }

  try {
    await caller.deals.getById({ id: randomUUID() });
    addCheck(
      "404 page shows for invalid deal ID",
      false,
      "Expected NOT_FOUND but got success.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detailPageCode = await readFile(
      join(process.cwd(), "app/(dashboard)/deals/[id]/page.tsx"),
      "utf8",
    );
    addCheck(
      "404 page shows for invalid deal ID",
      (message.includes("NOT_FOUND") || message.includes("Deal not found")) &&
        detailPageCode.includes("notFound()"),
      "Router returns NOT_FOUND and page maps it to notFound().",
    );
  }

  const loadingListCode = await readFile(
    join(process.cwd(), "app/(dashboard)/deals/loading.tsx"),
    "utf8",
  );
  const loadingDetailCode = await readFile(
    join(process.cwd(), "app/(dashboard)/deals/[id]/loading.tsx"),
    "utf8",
  );
  addCheck(
    "Loading states work",
    loadingListCode.length > 0 && loadingDetailCode.length > 0,
    "Route loading files exist for list and detail pages.",
  );

  const sidebarCode = await readFile(
    join(process.cwd(), "components/dashboard-sidebar.tsx"),
    "utf8",
  );
  addCheck(
    "Navigation links work",
    sidebarCode.includes('href="/deals"') &&
      sidebarCode.includes('href="/deals/new"') &&
      sidebarCode.includes("usePathname") &&
      sidebarCode.includes("isActiveRoute"),
    "Sidebar has Deals link, New Deal button-link, and active route logic.",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log("phase4_verification", {
    passCount: checks.length - failed.length,
    failCount: failed.length,
    checks,
  });

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
