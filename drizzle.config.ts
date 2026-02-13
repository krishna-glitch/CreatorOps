import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use DIRECT_URL for migrations (session mode required by Drizzle)
    // DATABASE_URL uses PgBouncer in transaction mode which doesn't support migrations
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
