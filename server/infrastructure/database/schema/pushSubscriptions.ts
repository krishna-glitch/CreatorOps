import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { pushNotificationDeliveries } from "./pushNotificationDeliveries";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      endpointUniqueIdx: uniqueIndex(
        "push_subscriptions_endpoint_unique_idx",
      ).on(table.endpoint),
      userActiveIdx: index("push_subscriptions_user_active_idx").on(
        table.userId,
        table.isActive,
      ),
    };
  },
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one, many }) => ({
    user: one(authUsers, {
      fields: [pushSubscriptions.userId],
      references: [authUsers.id],
    }),
    deliveries: many(pushNotificationDeliveries),
  }),
);
