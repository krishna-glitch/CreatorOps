import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

type TestResult = {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

async function run() {
  const results: TestResult[] = [];
  const [{ db }, { brands }, { appRouter }] = await Promise.all([
    import("@/db"),
    import("@/server/infrastructure/database/schema/brands"),
    import("@/server/api/root"),
  ]);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );

  const { data } = await supabase.auth.admin.listUsers();
  const testUser = data.users.find(
    (u) => u.email === "testuser@creatorops.dev",
  );

  if (!testUser) {
    throw new Error("Test user not found. Run npm run db:seed first.");
  }

  const userBrandRows = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.userId, testUser.id))
    .limit(1);

  if (userBrandRows.length === 0) {
    throw new Error("No brand found for test user. Run npm run db:seed first.");
  }

  const brand = userBrandRows[0];

  const caller = appRouter.createCaller({
    db,
    user: testUser,
    headers: new Headers(),
  });

  try {
    const created = await caller.deals.create({
      brand_id: brand.id,
      title: `Phase3 Manual Test ${Date.now()}`,
      total_value: 1000,
      currency: "USD",
      status: "INBOUND",
    });

    const ok = created.brand?.id === brand.id && created.title.length > 0;
    results.push({
      name: "1) Valid deal creation",
      status: ok ? "PASS" : "FAIL",
      detail: ok
        ? `Created deal ${created.id} for brand ${created.brand?.name ?? "unknown"}`
        : "Deal did not include expected brand relation",
    });
  } catch (error) {
    results.push({
      name: "1) Valid deal creation",
      status: "FAIL",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    await caller.deals.create({
      brand_id: brand.id,
      title: "",
      total_value: 100,
      currency: "USD",
      status: "INBOUND",
    });
    results.push({
      name: "2) Empty title validation",
      status: "FAIL",
      detail: "Mutation unexpectedly succeeded",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const pass = message.toLowerCase().includes("title");
    results.push({
      name: "2) Empty title validation",
      status: pass ? "PASS" : "FAIL",
      detail: message,
    });
  }

  try {
    await caller.deals.create({
      brand_id: brand.id,
      title: "Negative amount test",
      total_value: -10,
      currency: "USD",
      status: "INBOUND",
    });
    results.push({
      name: "3) Negative amount validation",
      status: "FAIL",
      detail: "Mutation unexpectedly succeeded",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const pass =
      message.toLowerCase().includes("number") ||
      message.toLowerCase().includes("positive") ||
      message.toLowerCase().includes("greater than");
    results.push({
      name: "3) Negative amount validation",
      status: pass ? "PASS" : "FAIL",
      detail: message,
    });
  }

  try {
    await caller.deals.create({
      brand_id: "11111111-1111-4111-8111-111111111111",
      title: "Invalid brand test",
      total_value: 100,
      currency: "USD",
      status: "INBOUND",
    });
    results.push({
      name: "4) Invalid brand id",
      status: "FAIL",
      detail: "Mutation unexpectedly succeeded",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const pass =
      message.toLowerCase().includes("brand not found") ||
      message.toLowerCase().includes("could not create deal");
    results.push({
      name: "4) Invalid brand id",
      status: pass ? "PASS" : "FAIL",
      detail: message,
    });
  }

  results.push({
    name: "5) Network error simulation",
    status: "SKIP",
    detail:
      "Not fully automatable in createCaller script. Verify manually in browser DevTools (Offline) and confirm Sonner error toast appears.",
  });

  console.log("\nPhase 3 Manual Test Results\n");
  for (const result of results) {
    console.log(
      `${result.status.padEnd(4)} ${result.name} -> ${result.detail}`,
    );
  }
}

run().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
