import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error("DIRECT_URL is not set");
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use DIRECT_URL for migrations (session mode required by Drizzle)
    // DATABASE_URL uses PgBouncer in transaction mode which doesn't support migrations
    url: directUrl,
  },
  verbose: true,
  strict: true,
});
