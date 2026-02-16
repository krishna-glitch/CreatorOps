import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { appRouter } from "@/server/api/root";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const createCaller = (user: any) => {
    const ctx = {
        db,
        user,
        headers: new Headers(),
    };
    return appRouter.createCaller(ctx);
};

async function main() {
    console.log("🔍 Verifying Calendar Drag & Drop Mutation...\n");

    // 1. Get a user
    const users = await db.execute(sql`SELECT id, email FROM auth.users LIMIT 1`);
    if (users.length === 0) {
        console.error("❌ No users found.");
        process.exit(1);
    }
    const testUser = users[0] as { id: string; email: string };
    const caller = createCaller({ id: testUser.id });

    // 2. Find a deliverable to move
    console.log("Searching for a test deliverable...");
    const deliverableRows = await db.execute(sql`
    SELECT d.id, d.scheduled_at 
    FROM deliverables d
    JOIN deals dl ON d.deal_id = dl.id
    WHERE dl.user_id = ${testUser.id}
    AND d.status != 'POSTED'
    LIMIT 1
  `);

    if (deliverableRows.length === 0) {
        console.log("⚠️ No suitable deliverable found to test. creating one or skipping.");
    } else {
        const deliverable = deliverableRows[0] as { id: string; scheduled_at: string | Date | null };
        if (!deliverable.scheduled_at) {
            console.log("⚠️ Deliverable has no scheduled date. Skipping.");
            process.exit(0);
        }
        const originalDate = new Date(deliverable.scheduled_at);
        const newDate = new Date(originalDate);
        newDate.setDate(originalDate.getDate() + 1); // Move by 1 day

        console.log(`📦 Found deliverable ${deliverable.id}`);
        console.log(`   Original Date: ${originalDate.toISOString()}`);
        console.log(`   Moving to:     ${newDate.toISOString()}`);

        try {
            await caller.calendar.updateEventDate({
                sourceId: deliverable.id,
                eventType: 'deliverable',
                newDate: newDate,
            });
            console.log("✅ Mutation successful!");

            // Verify persistence
            const updated = await db.execute(sql`
        SELECT scheduled_at FROM deliverables WHERE id = ${deliverable.id}
      `);
            const updatedRow = updated[0] as { scheduled_at: string | Date | null };
            if (!updatedRow?.scheduled_at) {
                console.error("❌ Persistence failed. scheduled_at became null.");
                process.exit(1);
            }
            const updatedDate = new Date(updatedRow.scheduled_at);

            // Compare roughly (database might store micros/millis differently)
            if (Math.abs(updatedDate.getTime() - newDate.getTime()) < 1000) {
                console.log("✅ Persistence verified!");
            } else {
                console.error(`❌ Persistence failed. Got ${updatedDate.toISOString()}, expected ${newDate.toISOString()}`);
            }

            // Move back to be nice
            await caller.calendar.updateEventDate({
                sourceId: deliverable.id,
                eventType: 'deliverable',
                newDate: originalDate,
            });
            console.log("✅ Reverted change.");

        } catch (e) {
            console.error("❌ Mutation failed:", e);
        }
    }

    process.exit(0);
}

main();
