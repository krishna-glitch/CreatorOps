import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deliverables } from "./deliverables";

export const mediaAssetTypeEnum = pgEnum("media_asset_type", [
  "RAW_VIDEO",
  "EDITED_VIDEO",
  "THUMBNAIL",
  "SCRIPT",
  "CAPTION",
  "B_ROLL",
]);

export const mediaAssetStatusEnum = pgEnum("media_asset_status", [
  "DRAFT",
  "SUBMITTED_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "FINAL",
]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id, { onDelete: "cascade" }),
    assetType: mediaAssetTypeEnum("asset_type").notNull(),
    versionNumber: integer("version_number").default(1).notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    durationSeconds: integer("duration_seconds"),
    dimensions: jsonb("dimensions").$type<{ width: number; height: number }>(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    status: mediaAssetStatusEnum("status").default("DRAFT").notNull(),
    approvalNotes: text("approval_notes"),
    tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
    scriptContent: text("script_content"),
    versionHistory: jsonb("version_history")
      .$type<
        Array<{
          version: number;
          content: string;
          saved_at: string;
          word_count: number;
        }>
      >()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      deliverableIdIdx: index("media_assets_deliverable_id_idx").on(
        table.deliverableId,
      ),
      assetTypeIdx: index("media_assets_asset_type_idx").on(table.assetType),
      statusIdx: index("media_assets_status_idx").on(table.status),
      versionNumberPositiveCheck: check(
        "media_assets_version_number_positive_check",
        sql`${table.versionNumber} >= 1`,
      ),
      fileSizeNonNegativeCheck: check(
        "media_assets_file_size_non_negative_check",
        sql`${table.fileSizeBytes} >= 0`,
      ),
      durationNonNegativeCheck: check(
        "media_assets_duration_non_negative_check",
        sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
      ),
    };
  },
);

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  deliverable: one(deliverables, {
    fields: [mediaAssets.deliverableId],
    references: [deliverables.id],
  }),
}));
