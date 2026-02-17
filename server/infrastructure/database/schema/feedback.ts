import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { deliverables } from "./deliverables";

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "CREATIVE_DIRECTION",
  "COMPLIANCE",
  "BRAND_VOICE",
  "EDITING",
  "COPY",
  "TIMING",
  "TECHNICAL",
  "OTHER",
]);

export const feedbackSentimentEnum = pgEnum("feedback_sentiment", [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "FRUSTRATED",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
]);

export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, {
      onDelete: "set null",
    }),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    feedbackType: feedbackTypeEnum("feedback_type").notNull(),
    severity: integer("severity").notNull(),
    sentiment: feedbackSentimentEnum("sentiment").notNull(),
    messageRaw: text("message_raw").notNull(),
    summary: text("summary"),
    status: feedbackStatusEnum("status").default("OPEN").notNull(),
    resolutionNotes: text("resolution_notes"),
    timeSpentMinutes: integer("time_spent_minutes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      dealIdIdx: index("feedback_items_deal_id_idx").on(table.dealId),
      deliverableIdIdx: index("feedback_items_deliverable_id_idx").on(
        table.deliverableId,
      ),
      receivedAtIdx: index("feedback_items_received_at_idx").on(
        table.receivedAt,
      ),
      feedbackTypeIdx: index("feedback_items_feedback_type_idx").on(
        table.feedbackType,
      ),
      statusIdx: index("feedback_items_status_idx").on(table.status),
      severityCheck: check(
        "feedback_items_severity_1_to_10_check",
        sql`${table.severity} between 1 and 10`,
      ),
      timeSpentNonNegativeCheck: check(
        "feedback_items_time_spent_non_negative_check",
        sql`${table.timeSpentMinutes} is null or ${table.timeSpentMinutes} >= 0`,
      ),
    };
  },
);

export const feedbackItemsRelations = relations(feedbackItems, ({ one }) => ({
  deal: one(deals, {
    fields: [feedbackItems.dealId],
    references: [deals.id],
  }),
  deliverable: one(deliverables, {
    fields: [feedbackItems.deliverableId],
    references: [deliverables.id],
  }),
}));
