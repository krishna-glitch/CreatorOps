import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appRouter } from "@/server/api/root";

dotenv.config({ path: ".env.local" });

async function main() {
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

  const [vapid, status] = await Promise.all([
    caller.notifications.getVapidPublicKey(),
    caller.notifications.status(),
  ]);

  console.log({
    userId,
    vapid,
    status,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
