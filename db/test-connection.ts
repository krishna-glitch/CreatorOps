/**
 * Database Connection Test Script
 *
 * This script tests both database connections:
 * 1. DATABASE_URL (transaction mode for app queries)
 * 2. DIRECT_URL (session mode for migrations)
 *
 * Run with: npm run db:test
 */

import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

async function testDatabaseConnection() {
  console.log("🔍 Testing Database Connections...\n");

  // Test 1: DATABASE_URL (Transaction Mode)
  console.log("1️⃣  Testing DATABASE_URL (Transaction Mode - for app queries)");
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  try {
    const sql = postgres(process.env.DATABASE_URL);
    const result =
      await sql`SELECT version(), current_database(), current_user`;
    console.log("✅ DATABASE_URL connection successful!");
    console.log("   PostgreSQL Version:", result[0].version.split(" ")[1]);
    console.log("   Database:", result[0].current_database);
    console.log("   User:", result[0].current_user);
    await sql.end();
  } catch (error) {
    console.error("❌ DATABASE_URL connection failed:", error);
    process.exit(1);
  }

  console.log("");

  // Test 2: DIRECT_URL (Session Mode)
  console.log("2️⃣  Testing DIRECT_URL (Session Mode - for migrations)");
  if (!process.env.DIRECT_URL) {
    console.error("❌ DIRECT_URL is not set in .env.local");
    process.exit(1);
  }

  try {
    const sql = postgres(process.env.DIRECT_URL, { max: 1 });
    const result =
      await sql`SELECT version(), current_database(), current_user`;
    console.log("✅ DIRECT_URL connection successful!");
    console.log("   PostgreSQL Version:", result[0].version.split(" ")[1]);
    console.log("   Database:", result[0].current_database);
    console.log("   User:", result[0].current_user);
    await sql.end();
  } catch (error) {
    console.error("❌ DIRECT_URL connection failed:", error);
    process.exit(1);
  }

  console.log("");

  // Test 3: Drizzle Client
  console.log("3️⃣  Testing Drizzle ORM Client");
  try {
    const { db } = await import("./index");
    const { sql } = await import("drizzle-orm");
    // Simple query to test Drizzle
    const _result = await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Drizzle client initialized successfully!");
    console.log("   Test query executed successfully");
  } catch (error) {
    console.error("❌ Drizzle client test failed:", error);
    process.exit(1);
  }

  console.log("");
  console.log("🎉 All database connections are working correctly!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Create your first schema in db/schema/");
  console.log("2. Run: npm run db:generate");
  console.log("3. Run: npm run db:push");

  process.exit(0);
}

testDatabaseConnection();
