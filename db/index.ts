import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is not set");
}

// For app queries - uses PgBouncer in transaction mode (connection pooling)
const queryClient = postgres(process.env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

// For migrations - uses direct connection in session mode
// This is required because PgBouncer transaction mode doesn't support all PostgreSQL features
export const migrationClient = postgres(process.env.DIRECT_URL, { max: 1 });
