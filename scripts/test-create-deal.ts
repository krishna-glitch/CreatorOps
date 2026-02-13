import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appRouter } from "@/server/api/root";
import { brands } from "@/server/infrastructure/database/schema/brands";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("🧪 Starting test-create-deal...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  // 1. Get a valid user (from seed)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const testUser = users.find((u) => u.email === "testuser@creatorops.dev");

  if (!testUser) {
    throw new Error("Test user not found. Run 'npm run db:seed' first.");
  }

  console.log(`👤 Found user: ${testUser.id}`);

  // 2. Get a valid brand for this user
  const userBrands = await db
    .select()
    .from(brands)
    .where(eq(brands.userId, testUser.id))
    .limit(1);
  if (userBrands.length === 0) {
    throw new Error(
      "No brands found for test user. Run 'npm run db:seed' first.",
    );
  }
  const brand = userBrands[0];
  console.log(`🏷️  Found brand: ${brand.name} (${brand.id})`);

  // 3. Create context with mocked user
  const ctx = {
    db,
    user: testUser,
    headers: new Headers(),
  };

  // 4. Create caller
  const caller = appRouter.createCaller(ctx);

  // 5. Call mutation
  console.log("🚀 Calling deals.create...");
  try {
    const deal = await caller.deals.create({
      brand_id: brand.id,
      title: "Test Deal from Script",
      total_value: 1234.56,
      currency: "USD",
      status: "INBOUND",
    });

    console.log("✅ Deal created successfully!");
    console.log(deal);
  } catch (err) {
    console.error("❌ Failed to create deal:");
    console.error(err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
