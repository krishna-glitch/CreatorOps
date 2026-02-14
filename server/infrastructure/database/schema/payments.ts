import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(), // USD | INR | OTHER
    kind: text("kind").notNull(), // DEPOSIT | FINAL | PARTIAL | OTHER
    status: text("status").notNull(), // EXPECTED | PAID | OVERDUE
    expectedDate: timestamp("expected_date"),
    paidAt: timestamp("paid_at"),
    paymentMethod: text("payment_method"), // PAYPAL | WIRE | VENMO | ZELLE | OTHER
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      dealIdIdx: index("payments_deal_id_idx").on(table.dealId),
      statusExpectedDateIdx: index("payments_status_expected_date_idx").on(
        table.status,
        table.expectedDate,
      ),
    };
  },
);

// Relations: Payment belongs to Deal
export const paymentsRelations = relations(payments, ({ one }) => ({
  deal: one(deals, {
    fields: [payments.dealId],
    references: [deals.id],
  }),
}));
