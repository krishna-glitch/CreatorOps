import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

async function main() {
  const [{ db }, { appRouter }] = await Promise.all([
    import("@/db"),
    import("@/server/api/root"),
  ]);

  const users = await db.execute(sql`select id from auth.users limit 1`);
  if (users.length === 0) {
    throw new Error("No users found");
  }

  const userId = (users[0] as { id: string }).id;
  const caller = appRouter.createCaller({
    db,
    user: { id: userId } as any,
    headers: new Headers(),
  } as any);

  console.log("Calling notifications.getVapidPublicKey...");
  try {
    const vapid = await caller.notifications.getVapidPublicKey();
    console.log("VAPID key:", vapid);
  } catch (error) {
    console.error("VAPID error:", error);
  }

  console.log("Calling notifications.unsubscribe...");
  try {
    await caller.notifications.unsubscribe({});
    console.log("Unsubscribe (no endpoint) successful.");
  } catch (error) {
    console.error("Unsubscribe error:", error);
  }

  console.log("Calling notifications.subscribe...");
  try {
    await caller.notifications.subscribe({
      endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint-2",
      keys: {
        p256dh: "BMk...", // Dummy key
        auth: "R29...", // Dummy auth
      },
    });
    console.log("Subscription successful.");
  } catch (error) {
    console.error("Subscribe error:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
