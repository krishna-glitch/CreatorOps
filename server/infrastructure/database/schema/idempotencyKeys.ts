import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    state: text("state").notNull().default("IN_PROGRESS"),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    responseContentType: text("response_content_type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at")
      .default(sql`now() + interval '24 hours'`)
      .notNull(),
  },
  (table) => ({
    userEndpointKeyUnique: uniqueIndex("idempotency_user_endpoint_key_uidx").on(
      table.userId,
      table.endpoint,
      table.key,
    ),
    expiresAtIdx: index("idempotency_expires_at_idx").on(table.expiresAt),
  }),
);
