import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is not set");
}

type GlobalDbState = {
  queryClient?: ReturnType<typeof postgres>;
};

const globalDb = globalThis as typeof globalThis & { __db?: GlobalDbState };

// Reuse a single query client in dev to avoid exhausting DB connections on HMR reloads.
const queryClient =
  globalDb.__db?.queryClient ??
  postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalDb.__db = { queryClient };
}

export const db = drizzle(queryClient, { schema });

// For migrations/scripts, create a dedicated direct connection only when needed.
export function createMigrationClient() {
  return postgres(process.env.DIRECT_URL as string, { max: 1 });
}
