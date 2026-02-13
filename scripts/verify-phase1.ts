import * as dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands } from "../server/infrastructure/database/schema/brands";
import { deals } from "../server/infrastructure/database/schema/deals";

dotenv.config({ path: ".env.local" });

async function verify() {
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is not set");
  }

  const connection = postgres(process.env.DIRECT_URL, { max: 1 });
  const db = drizzle(connection);
  let passed = 0;
  let failed = 0;

  function pass(test: string) {
    console.log(`  ✅ ${test}`);
    passed++;
  }

  function fail(test: string, err?: string) {
    console.log(`  ❌ ${test}${err ? ": " + err : ""}`);
    failed++;
  }

  console.log("🔍 Phase 1 Verification\n");

  // --- 1. Tables exist ---
  console.log("1️⃣  Tables exist in database");
  try {
    const tableCheck = await connection`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('brands', 'deals')
      ORDER BY table_name
    `;
    const tableNames = tableCheck.map(
      (r: Record<string, string>) => r.table_name,
    );
    if (tableNames.includes("brands") && tableNames.includes("deals")) {
      pass(`Found tables: ${tableNames.join(", ")}`);
    } else {
      fail(`Missing tables. Found: ${tableNames.join(", ")}`);
    }
  } catch (e: unknown) {
    fail("Table check failed", (e as Error).message);
  }

  // --- 2. Check columns ---
  console.log("\n2️⃣  Table columns correct");
  try {
    const brandCols = await connection`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'brands'
      ORDER BY ordinal_position
    `;
    const brandColNames = brandCols.map(
      (r: Record<string, string>) => r.column_name,
    );
    const expectedBrandCols = [
      "id",
      "user_id",
      "name",
      "created_at",
      "updated_at",
    ];
    const brandMatch = expectedBrandCols.every((c) =>
      brandColNames.includes(c),
    );
    if (brandMatch) {
      pass(`brands columns: ${brandColNames.join(", ")}`);
    } else {
      fail(`brands columns mismatch. Got: ${brandColNames.join(", ")}`);
    }

    const dealCols = await connection`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'deals'
      ORDER BY ordinal_position
    `;
    const dealColNames = dealCols.map(
      (r: Record<string, string>) => r.column_name,
    );
    const expectedDealCols = [
      "id",
      "user_id",
      "brand_id",
      "title",
      "total_value",
      "currency",
      "status",
      "created_at",
      "updated_at",
    ];
    const dealMatch = expectedDealCols.every((c) => dealColNames.includes(c));
    if (dealMatch) {
      pass(`deals columns: ${dealColNames.join(", ")}`);
    } else {
      fail(`deals columns mismatch. Got: ${dealColNames.join(", ")}`);
    }
  } catch (e: unknown) {
    fail("Column check failed", (e as Error).message);
  }

  // --- 3. Foreign keys ---
  console.log("\n3️⃣  Foreign key constraints");
  try {
    const fks = await connection`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name,
             ccu.table_schema AS foreign_table_schema,
             ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `;
    for (const fk of fks) {
      pass(
        `${fk.table_name}.${fk.column_name} → ${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}`,
      );
    }
    if (fks.length === 0) fail("No foreign keys found");
  } catch (e: unknown) {
    fail("FK check failed", (e as Error).message);
  }

  // --- 4. FK enforcement (try invalid brand_id) ---
  console.log("\n4️⃣  FK enforcement (invalid brand_id should fail)");
  try {
    await db.insert(deals).values({
      userId: "00000000-0000-0000-0000-000000000000",
      brandId: "00000000-0000-0000-0000-000000000000",
      title: "TEST - Should fail",
    });
    fail("Insert with invalid brand_id should have thrown!");
    // Clean up if somehow it succeeded
    await connection`DELETE FROM deals WHERE title = 'TEST - Should fail'`;
  } catch {
    pass("Insert with invalid brand_id correctly rejected");
  }

  // --- 5. Indexes ---
  console.log("\n5️⃣  Indexes exist");
  try {
    const indexes = await connection`
      SELECT indexname, tablename FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename IN ('brands', 'deals')
      ORDER BY tablename, indexname
    `;
    for (const idx of indexes) {
      pass(`${idx.tablename}: ${idx.indexname}`);
    }
    const expectedIndexes = [
      "brands_user_id_idx",
      "deals_user_id_idx",
      "deals_brand_id_idx",
      "deals_status_idx",
    ];
    for (const expected of expectedIndexes) {
      if (
        !indexes.some((i: Record<string, string>) => i.indexname === expected)
      ) {
        fail(`Missing index: ${expected}`);
      }
    }
  } catch (e: unknown) {
    fail("Index check failed", (e as Error).message);
  }

  // --- 6. Seed data ---
  console.log("\n6️⃣  Seed data exists");
  try {
    const brandCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(brands);
    const dealCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(deals);
    const bCount = Number(brandCount[0]?.count);
    const dCount = Number(dealCount[0]?.count);

    if (bCount >= 3) pass(`${bCount} brands found (expected ≥ 3)`);
    else fail(`Only ${bCount} brands found (expected ≥ 3)`);

    if (dCount >= 5) pass(`${dCount} deals found (expected ≥ 5)`);
    else fail(`Only ${dCount} deals found (expected ≥ 5)`);

    // Check brand names
    const brandNames = await db.select({ name: brands.name }).from(brands);
    const names = brandNames.map((b) => b.name);
    pass(`Brand names: ${names.join(", ")}`);

    // Check deal statuses
    const dealStatuses = await db
      .select({ status: deals.status, title: deals.title })
      .from(deals);
    for (const d of dealStatuses) {
      pass(`Deal: ${d.title} — ${d.status}`);
    }
  } catch (e: unknown) {
    fail("Seed data check failed", (e as Error).message);
  }

  // --- Summary ---
  console.log("\n" + "═".repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All Phase 1 verifications PASSED!");
  } else {
    console.log("⚠️  Some verifications FAILED");
  }

  await connection.end();
  process.exit(failed > 0 ? 1 : 0);
}

verify();
