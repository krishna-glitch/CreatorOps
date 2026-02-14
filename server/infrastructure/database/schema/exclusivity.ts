import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";

export const exclusivityScopeEnum = pgEnum("exclusivity_scope", [
  "EXACT_CATEGORY",
  "PARENT_CATEGORY",
]);

export const exclusivityPlatformEnum = pgEnum("exclusivity_platform", [
  "INSTAGRAM",
  "YOUTUBE",
  "TIKTOK",
]);

export const exclusivityRegionEnum = pgEnum("exclusivity_region", [
  "US",
  "IN",
  "GLOBAL",
]);

export const conflictTypeEnum = pgEnum("conflict_type", [
  "EXCLUSIVITY",
  "REVISION_LIMIT",
  "APPROVAL_SLA",
  "PAYMENT_DISPUTE",
]);

export const conflictSeverityEnum = pgEnum("conflict_severity", ["WARN", "BLOCK"]);

export const exclusivityRules = pgTable(
  "exclusivity_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    categoryPath: text("category_path").notNull(),
    scope: exclusivityScopeEnum("scope").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    platforms: exclusivityPlatformEnum("platforms").array().notNull(),
    regions: exclusivityRegionEnum("regions").array().notNull(),
    notes: text("notes"),
  },
  (table) => {
    return {
      dealIdIdx: index("exclusivity_rules_deal_id_idx").on(table.dealId),
      dateRangeCheck: check(
        "exclusivity_rules_start_date_before_end_date_check",
        sql`${table.startDate} <= ${table.endDate}`,
      ),
    };
  },
);

export const conflicts = pgTable(
  "conflicts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: conflictTypeEnum("type").notNull(),
    newDealOrDeliverableId: uuid("new_deal_or_deliverable_id").notNull(),
    conflictingRuleId: uuid("conflicting_rule_id").references(
      () => exclusivityRules.id,
      { onDelete: "set null" },
    ),
    overlap: jsonb("overlap").notNull(),
    severity: conflictSeverityEnum("severity").notNull(),
    suggestedResolutions: text("suggested_resolutions").array().notNull(),
    autoResolved: boolean("auto_resolved").default(false).notNull(),
  },
  (table) => {
    return {
      typeIdx: index("conflicts_type_idx").on(table.type),
      severityIdx: index("conflicts_severity_idx").on(table.severity),
      conflictingRuleIdIdx: index("conflicts_conflicting_rule_id_idx").on(
        table.conflictingRuleId,
      ),
      newDealOrDeliverableIdIdx: index("conflicts_new_deal_or_deliverable_id_idx").on(
        table.newDealOrDeliverableId,
      ),
    };
  },
);

export const exclusivityRulesRelations = relations(exclusivityRules, ({ one, many }) => ({
  deal: one(deals, {
    fields: [exclusivityRules.dealId],
    references: [deals.id],
  }),
  conflicts: many(conflicts),
}));

export const conflictsRelations = relations(conflicts, ({ one }) => ({
  conflictingRule: one(exclusivityRules, {
    fields: [conflicts.conflictingRuleId],
    references: [exclusivityRules.id],
  }),
}));
