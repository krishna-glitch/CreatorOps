import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const runMigrations = async () => {
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is not set");
  }

  console.log("⏳ Running migrations...");

  const connection = postgres(process.env.DIRECT_URL, { max: 1 });
  const db = drizzle(connection);

  await migrate(db, { migrationsFolder: "./drizzle" });

  await connection.end();

  console.log("✅ Migrations completed");
};

runMigrations().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
