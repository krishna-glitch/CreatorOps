import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pushSubscriptions } from "./pushSubscriptions";
import { reminders } from "./reminders";

export const pushDeliveryStatusEnum = pgEnum("push_delivery_status", [
  "SENT",
  "FAILED",
]);

export const pushNotificationDeliveries = pgTable(
  "push_notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reminderId: uuid("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: pushDeliveryStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      reminderSubscriptionScheduledUniqueIdx: uniqueIndex(
        "push_delivery_reminder_subscription_scheduled_unique_idx",
      ).on(table.reminderId, table.subscriptionId, table.scheduledFor),
      reminderIdx: index("push_delivery_reminder_idx").on(table.reminderId),
      subscriptionIdx: index("push_delivery_subscription_idx").on(
        table.subscriptionId,
      ),
    };
  },
);

export const pushNotificationDeliveriesRelations = relations(
  pushNotificationDeliveries,
  ({ one }) => ({
    reminder: one(reminders, {
      fields: [pushNotificationDeliveries.reminderId],
      references: [reminders.id],
    }),
    subscription: one(pushSubscriptions, {
      fields: [pushNotificationDeliveries.subscriptionId],
      references: [pushSubscriptions.id],
    }),
  }),
);
