import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { deliverables } from "./deliverables";

export const reworkCycles = pgTable(
  "rework_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    requestSummary: text("request_summary").notNull(),
    whatChanged: text("what_changed"),
    clientApproved: boolean("client_approved").default(false).notNull(),
    exceedsContractLimit: boolean("exceeds_contract_limit")
      .default(false)
      .notNull(),
    timeSpentMinutes: integer("time_spent_minutes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      deliverableIdIdx: index("rework_cycles_deliverable_id_idx").on(table.deliverableId),
      cycleNumberIdx: index("rework_cycles_cycle_number_idx").on(table.cycleNumber),
      requestedAtIdx: index("rework_cycles_requested_at_idx").on(table.requestedAt),
      deliverableCycleUniqueIdx: uniqueIndex(
        "rework_cycles_deliverable_id_cycle_number_unique_idx",
      ).on(table.deliverableId, table.cycleNumber),
      cycleNumberPositiveCheck: check(
        "rework_cycles_cycle_number_positive_check",
        sql`${table.cycleNumber} >= 1`,
      ),
      timeSpentNonNegativeCheck: check(
        "rework_cycles_time_spent_non_negative_check",
        sql`${table.timeSpentMinutes} is null or ${table.timeSpentMinutes} >= 0`,
      ),
    };
  },
);

export const reworkCyclesRelations = relations(reworkCycles, ({ one }) => ({
  deliverable: one(deliverables, {
    fields: [reworkCycles.deliverableId],
    references: [deliverables.id],
  }),
}));
