import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { brands } from "../server/infrastructure/database/schema/brands";
import { deals } from "../server/infrastructure/database/schema/deals";

dotenv.config({ path: ".env.local" });

const SEED_USER_EMAIL = "testuser@creatorops.dev";
const SEED_USER_PASSWORD = "TestPassword123!";

async function seed() {
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is not set");
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Supabase env vars are not set");
  }

  const connection = postgres(process.env.DIRECT_URL, { max: 1 });
  const db = drizzle(connection);

  // Use Supabase Admin client to create/find a test user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log("🌱 Starting seed...\n");

  // --- Step 1: Create or find test user ---
  console.log("1️⃣  Creating test user...");
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId: string;

  const existing = existingUsers?.users?.find(
    (u) => u.email === SEED_USER_EMAIL,
  );
  if (existing) {
    userId = existing.id;
    console.log(`   Found existing user: ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: SEED_USER_EMAIL,
      password: SEED_USER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = data.user.id;
    console.log(`   Created new user: ${userId}`);
  }

  // --- Step 2: Clean existing seed data (idempotent) ---
  console.log("\n2️⃣  Cleaning existing seed data...");
  await db.delete(deals).where(eq(deals.userId, userId));
  await db.delete(brands).where(eq(brands.userId, userId));
  console.log("   Cleaned.");

  // --- Step 3: Seed brands ---
  console.log("\n3️⃣  Seeding brands...");
  const seedBrands = await db
    .insert(brands)
    .values([
      { userId, name: "Nike" },
      { userId, name: "Adidas" },
      { userId, name: "Apple" },
    ])
    .returning();

  for (const b of seedBrands) {
    console.log(`   ✅ Brand: ${b.name} (${b.id})`);
  }

  const [nike, adidas, apple] = seedBrands;

  if (!nike || !adidas || !apple) {
    throw new Error("Failed to seed brands");
  }

  // --- Step 4: Seed deals ---
  console.log("\n4️⃣  Seeding deals...");
  const seedDeals = await db
    .insert(deals)
    .values([
      {
        userId,
        brandId: nike.id,
        title: "Nike Summer Campaign 2025",
        totalValue: "5000.00",
        currency: "USD",
        status: "NEGOTIATING",
      },
      {
        userId,
        brandId: nike.id,
        title: "Nike Holiday Reel",
        totalValue: "2500.00",
        currency: "USD",
        status: "AGREED",
      },
      {
        userId,
        brandId: adidas.id,
        title: "Adidas Originals Collab",
        totalValue: "8000.00",
        currency: "USD",
        status: "INBOUND",
      },
      {
        userId,
        brandId: apple.id,
        title: "Apple Vision Pro Review",
        totalValue: "15000.00",
        currency: "USD",
        status: "COMPLETED",
      },
      {
        userId,
        brandId: apple.id,
        title: "Apple Back to School",
        totalValue: "3500.00",
        currency: "USD",
        status: "PAID",
      },
    ])
    .returning();

  for (const d of seedDeals) {
    console.log(`   ✅ Deal: ${d.title} — ${d.status} ($${d.totalValue})`);
  }

  // --- Done ---
  console.log("\n🎉 Seed complete!");
  console.log(`   ${seedBrands.length} brands, ${seedDeals.length} deals`);
  console.log(`   Test user: ${SEED_USER_EMAIL} / ${SEED_USER_PASSWORD}`);

  await connection.end();
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:");
  console.error(err);
  process.exit(1);
});
