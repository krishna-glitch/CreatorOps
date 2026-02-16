import { and, eq, inArray } from "drizzle-orm";
import { generateRemindersForDeliverable } from "./ReminderGenerator";
import { reminders } from "@/server/infrastructure/database/schema/reminders";

type ReminderDbClient = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
};

type DeliverableSnapshot = {
  id: string;
  dealId: string;
  scheduledAt: Date | null;
  postedAt: Date | null;
  status: string;
};

export async function syncDeliverableReminders(params: {
  db: ReminderDbClient;
  deliverable: DeliverableSnapshot;
  now?: Date;
}) {
  const { db, deliverable } = params;
  const now = params.now ?? new Date();

  const shouldCancelAll =
    !deliverable.scheduledAt ||
    Boolean(deliverable.postedAt) ||
    deliverable.status === "POSTED" ||
    deliverable.status === "CANCELLED";

  if (shouldCancelAll) {
    await db
      .update(reminders)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(
        and(
          eq(reminders.deliverableId, deliverable.id),
          inArray(reminders.status, ["OPEN", "SNOOZED"]),
        ),
      );
    return;
  }

  const generated = generateRemindersForDeliverable({
    id: deliverable.id,
    deal_id: deliverable.dealId,
    scheduled_at: deliverable.scheduledAt,
    posted_at: deliverable.postedAt,
    now,
  });

  if (generated.length === 0) {
    await db
      .update(reminders)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(
        and(
          eq(reminders.deliverableId, deliverable.id),
          inArray(reminders.status, ["OPEN", "SNOOZED"]),
        ),
      );
    return;
  }

  await Promise.all(
    generated.map((item) =>
      db
        .insert(reminders)
        .values({
          dealId: item.deal_id,
          deliverableId: item.deliverable_id,
          reason: item.reason,
          dueAt: item.due_at,
          priority: item.priority,
          status: "OPEN",
          deliveryMethod: item.delivery_method,
          deliveryStatus: "PENDING",
          dedupeKey: item.dedupe_key,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: reminders.dedupeKey,
          set: {
            dealId: item.deal_id,
            deliverableId: item.deliverable_id,
            reason: item.reason,
            dueAt: item.due_at,
            priority: item.priority,
            status: "OPEN",
            deliveryStatus: "PENDING",
            updatedAt: now,
          },
        }),
    ),
  );

  const generatedKeys = generated.map((item) => item.dedupe_key);
  const existing = await db
    .select({
      id: reminders.id,
      dedupeKey: reminders.dedupeKey,
      status: reminders.status,
    })
    .from(reminders)
    .where(eq(reminders.deliverableId, deliverable.id));

  const toCancelIds = existing
    .filter((row: { dedupeKey: string; id: string; status: string }) => {
      return (
        !generatedKeys.includes(row.dedupeKey) &&
        (row.status === "OPEN" || row.status === "SNOOZED")
      );
    })
    .map((row: { id: string }) => row.id);

  if (toCancelIds.length > 0) {
    await db
      .update(reminders)
      .set({
        status: "CANCELLED",
        updatedAt: now,
      })
      .where(inArray(reminders.id, toCancelIds));
  }
}
