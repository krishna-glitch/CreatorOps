import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

export const scriptLabFiles = pgTable(
  "script_lab_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown").default("").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("script_lab_files_user_id_idx").on(table.userId),
    updatedAtIdx: index("script_lab_files_updated_at_idx").on(table.updatedAt),
  }),
);

export const scriptLabFilesRelations = relations(scriptLabFiles, ({ one }) => ({
  user: one(authUsers, {
    fields: [scriptLabFiles.userId],
    references: [authUsers.id],
  }),
}));
