import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const clientErrorLogs = pgTable(
  "client_error_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: varchar("type", { length: 100 }).notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    pathname: varchar("pathname", { length: 500 }),
    userAgent: text("user_agent"),
    reportedAt: timestamp("reported_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      reportedAtIdx: index("client_error_logs_reported_at_idx").on(
        table.reportedAt,
      ),
      createdAtIdx: index("client_error_logs_created_at_idx").on(
        table.createdAt,
      ),
      typeIdx: index("client_error_logs_type_idx").on(table.type),
    };
  },
);
