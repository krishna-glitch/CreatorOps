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
import { deals } from "./deals";
import { deliverables } from "./deliverables";

export const reminderPriorityEnum = pgEnum("reminder_priority", [
  "LOW",
  "MED",
  "HIGH",
  "CRITICAL",
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "OPEN",
  "DONE",
  "SNOOZED",
  "CANCELLED",
]);

export const reminderDeliveryMethodEnum = pgEnum("reminder_delivery_method", [
  "EMAIL",
]);

export const reminderDeliveryStatusEnum = pgEnum("reminder_delivery_status", [
  "PENDING",
  "SENT",
  "FAILED",
]);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    dueAt: timestamp("due_at").notNull(),
    priority: reminderPriorityEnum("priority").default("MED").notNull(),
    status: reminderStatusEnum("status").default("OPEN").notNull(),
    deliveryMethod: reminderDeliveryMethodEnum("delivery_method")
      .default("EMAIL")
      .notNull(),
    deliveryStatus: reminderDeliveryStatusEnum("delivery_status")
      .default("PENDING")
      .notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      dueAtIdx: index("reminders_due_at_idx").on(table.dueAt),
      statusIdx: index("reminders_status_idx").on(table.status),
      dedupeKeyUniqueIdx: uniqueIndex("reminders_dedupe_key_unique_idx").on(
        table.dedupeKey,
      ),
    };
  },
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  deal: one(deals, {
    fields: [reminders.dealId],
    references: [deals.id],
  }),
  deliverable: one(deliverables, {
    fields: [reminders.deliverableId],
    references: [deliverables.id],
  }),
}));
