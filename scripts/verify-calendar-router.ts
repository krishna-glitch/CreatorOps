import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { appRouter } from "@/server/api/root";
import { db } from "@/db";
import { sql } from "drizzle-orm";
// Mock context creation
const createCaller = (user: any) => {
    const ctx = {
        db,
        user,
        headers: new Headers(),
    };
    return appRouter.createCaller(ctx);
};

async function main() {
    console.log("🔍 Verifying Calendar Router...\n");

    // 1. Get a user to act as
    // We need a user who likely has deals
    const users = await db.execute(sql`
    SELECT id, email FROM auth.users LIMIT 1
  `);

    // auth.users is distinct from public.auth_users (alias table?)
    // schema/auth.ts defines authUsers as referencing "auth.users"
    // Let's us db.select if possible, or raw sql.
    // The schema is: userId: uuid("user_id").references(() => authUsers.id)

    if (users.length === 0) {
        console.error("❌ No users found in database to test with.");
        process.exit(1);
    }

    const testUser = users[0];
    console.log(`👤 Testing as user: ${testUser.id} (${testUser.email})`);

    const caller = createCaller({ id: testUser.id });

    // 2. Test getEvents
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of month

    console.log(`\n📅 Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

    try {
        const result = await caller.calendar.getEvents({
            startDate,
            endDate,
        });

        console.log(`✅ Success! Found ${result.totalCount} events.`);
        if (result.events.length > 0) {
            console.table(result.events.slice(0, 5).map(e => ({
                type: e.eventType,
                date: e.eventDate.toISOString().split('T')[0],
                title: e.title.substring(0, 30),
                status: e.status
            })));
        } else {
            console.log("No events found for this period.");
        }

    } catch (error) {
        console.error("❌ Failed to fetch events:");
        console.error(error);
        process.exit(1);
    }

    process.exit(0);
}

main();
