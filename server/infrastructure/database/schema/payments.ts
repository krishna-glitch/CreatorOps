import { relations } from "drizzle-orm";
import {
  date,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";

export type ExchangeRateSource = "frankfurter" | "manual" | "cache";

export interface PaymentConversionData {
  amountUsd: number | null;
  exchangeRate: number | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: ExchangeRateSource | null;
  exchangeRateManual: number | null;
  exchangeRateManualNote: string | null;
}

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
    amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }),
    exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
    exchangeRateDate: date("exchange_rate_date"),
    exchangeRateSource: varchar("exchange_rate_source", { length: 50 }),
    exchangeRateManual: decimal("exchange_rate_manual", {
      precision: 10,
      scale: 6,
    }),
    exchangeRateManualNote: text("exchange_rate_manual_note"),
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
      dealStatusPaidAtIdx: index("payments_deal_status_paid_at_idx").on(
        table.dealId,
        table.status,
        table.paidAt,
      ),
      dealStatusExpectedDateIdx: index(
        "payments_deal_status_expected_date_idx",
      ).on(table.dealId, table.status, table.expectedDate),
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
