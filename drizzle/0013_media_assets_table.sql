DO $$
BEGIN
  CREATE TYPE "public"."media_asset_type" AS ENUM(
    'RAW_VIDEO',
    'EDITED_VIDEO',
    'THUMBNAIL',
    'SCRIPT',
    'CAPTION',
    'B_ROLL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."media_asset_status" AS ENUM(
    'DRAFT',
    'SUBMITTED_FOR_REVIEW',
    'APPROVED',
    'REJECTED',
    'FINAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deliverable_id" uuid NOT NULL,
  "asset_type" "media_asset_type" NOT NULL,
  "version_number" integer DEFAULT 1 NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "mime_type" text NOT NULL,
  "duration_seconds" integer,
  "dimensions" jsonb,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  "status" "media_asset_status" DEFAULT 'DRAFT' NOT NULL,
  "approval_notes" text,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "script_content" text,
  "version_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_version_number_positive_check" CHECK ("media_assets"."version_number" >= 1),
  CONSTRAINT "media_assets_file_size_non_negative_check" CHECK ("media_assets"."file_size_bytes" >= 0),
  CONSTRAINT "media_assets_duration_non_negative_check" CHECK ("media_assets"."duration_seconds" IS NULL OR "media_assets"."duration_seconds" >= 0)
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_deliverable_id_deliverables_id_fk"
  FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_deliverable_id_idx" ON "media_assets" USING btree ("deliverable_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_asset_type_idx" ON "media_assets" USING btree ("asset_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_status_idx" ON "media_assets" USING btree ("status");
