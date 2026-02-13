/**
 * Simple Database Connection Test
 * Tests the exact connection string you provided
 */

import postgres from "postgres";

async function testConnection() {
  console.log("🔍 Testing Supabase Connection...\n");

  // Your original DIRECT_URL
  const directUrl =
    "postgresql://postgres:R@my@18030908.@db.bjjsxufayzqnlilgwmbk.supabase.co:5432/postgres";

  console.log("Testing DIRECT_URL connection...");
  console.log("Host: db.bjjsxufayzqnlilgwmbk.supabase.co");
  console.log("Port: 5432\n");

  try {
    const sql = postgres(directUrl, { max: 1 });
    const result =
      await sql`SELECT version(), current_database(), current_user`;

    console.log("✅ Connection successful!\n");
    console.log("PostgreSQL Version:", result[0].version.split(" ")[1]);
    console.log("Database:", result[0].current_database);
    console.log("User:", result[0].current_user);

    await sql.end();

    console.log("\n🎉 Database connection is working!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed:\n");
    console.error(error);
    console.log("\n📝 Troubleshooting:");
    console.log("1. Check if your Supabase project is active");
    console.log(
      "2. Verify the connection string from: https://supabase.com/dashboard/project/bjjsxufayzqnlilgwmbk/settings/database",
    );
    console.log(
      "3. Make sure your IP is allowed (Supabase > Settings > Database > Connection Pooling)",
    );
    console.log(
      "4. Check if the password has special characters that need URL encoding",
    );
    process.exit(1);
  }
}

testConnection();
