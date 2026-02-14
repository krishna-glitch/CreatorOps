import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { brands } from "./brands";
import { deliverables } from "./deliverables";
import { payments } from "./payments";

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    totalValue: decimal("total_value", { precision: 12, scale: 2 }),
    currency: text("currency"),
    status: text("status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index("deals_user_id_idx").on(table.userId),
      brandIdIdx: index("deals_brand_id_idx").on(table.brandId),
      statusIdx: index("deals_status_idx").on(table.status),
    };
  },
);

// Relations: Deal belongs to Brand
export const dealsRelations = relations(deals, ({ one, many }) => ({
  brand: one(brands, {
    fields: [deals.brandId],
    references: [brands.id],
  }),
  deliverables: many(deliverables),
  payments: many(payments),
}));
