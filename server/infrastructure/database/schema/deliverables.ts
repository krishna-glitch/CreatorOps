import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    type: text("type").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    scheduledAt: timestamp("scheduled_at"),
    postedAt: timestamp("posted_at"),
    status: text("status").default("DRAFT").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      dealIdIdx: index("deliverables_deal_id_idx").on(table.dealId),
    };
  },
);

// Relations: Deliverable belongs to Deal
export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  deal: one(deals, {
    fields: [deliverables.dealId],
    references: [deals.id],
  }),
}));
