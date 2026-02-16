import { relations, sql } from "drizzle-orm";
import {
  check,
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { brands } from "./brands";
import { deliverables } from "./deliverables";
import { exclusivityRules } from "./exclusivity";
import { feedbackItems } from "./feedback";
import { payments } from "./payments";
import { reminders } from "./reminders";

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
    revisionLimit: integer("revision_limit").default(2).notNull(),
    revisionsUsed: integer("revisions_used").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index("deals_user_id_idx").on(table.userId),
      brandIdIdx: index("deals_brand_id_idx").on(table.brandId),
      statusIdx: index("deals_status_idx").on(table.status),
      userStatusCreatedIdx: index("deals_user_status_created_idx").on(
        table.userId,
        table.status,
        table.createdAt,
      ),
      userCreatedIdPaginationIdx: index(
        "deals_user_created_id_pagination_idx",
      ).on(table.userId, table.createdAt.desc(), table.id.desc()),
      revisionLimitPositiveCheck: check(
        "deals_revision_limit_positive_check",
        sql`${table.revisionLimit} >= 1`,
      ),
      revisionsUsedNonNegativeCheck: check(
        "deals_revisions_used_non_negative_check",
        sql`${table.revisionsUsed} >= 0`,
      ),
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
  feedbackItems: many(feedbackItems),
  exclusivityRules: many(exclusivityRules),
  payments: many(payments),
  reminders: many(reminders),
}));
