import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

const runVerification = async () => {
    if (!process.env.DIRECT_URL) {
        throw new Error("DIRECT_URL is not set");
    }

    console.log("🔍 Verifying calendar_events view...\n");

    const connection = postgres(process.env.DIRECT_URL);
    const db = drizzle(connection);

    try {
        // Check if view exists and query it
        const result = await db.execute(sql`
      SELECT * FROM calendar_events LIMIT 5;
    `);

        console.log("✅ View exists and is queryable!\n");
        console.log("Found", result.length, "events:");

        if (result.length > 0) {
            console.table(result);
        } else {
            console.log("No events found (this is expected if DB is empty of scheduled items)");
        }

        // Verify columns match expected types
        if (result.length > 0) {
            const row = result[0];
            const validations = [
                ['event_type', typeof row.event_type === 'string'],
                ['source_id', typeof row.source_id === 'string'],
                ['deal_id', typeof row.deal_id === 'string'],
                ['event_date', row.event_date instanceof Date],
                ['title', typeof row.title === 'string'],
                ['status', typeof row.status === 'string'],
                ['color', typeof row.color === 'string'],
            ];

            const failed = validations.filter(([, valid]) => !valid);
            if (failed.length > 0) {
                console.error("❌ Type validation failed for:", failed.map(f => f[0]).join(", "));
                process.exit(1);
            }
            console.log("\n✅ Type validation passed");
        }

        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error("❌ Verification failed:");
        console.error(error);
        await connection.end();
        process.exit(1);
    }
};

runVerification();
