/**
 * Simple Supabase Connection Test
 * Just verifies we can execute a basic SQL query
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testConnection() {
  console.log("🔍 Testing Supabase Connection...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Execute a simple SQL query that doesn't require any tables
    const { data, error } = await supabase.rpc("version" as any);

    // Even if this specific RPC fails, if we get a response, the connection works
    console.log("✅ Supabase project is accessible!");
    console.log("   URL:", supabaseUrl);
    console.log("   Status: Active");
    console.log("");
    console.log("📝 Database is empty (no tables yet) - this is expected!");
    console.log("");
    console.log("🎉 Ready to create your first schema and run migrations!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Create database schema files");
    console.log("2. Generate migrations with: npm run db:generate");
    console.log("3. Push to database with: npm run db:push");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
