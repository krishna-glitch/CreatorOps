ALTER TABLE "media_assets"
ADD COLUMN "script_content" text;
--> statement-breakpoint
ALTER TABLE "media_assets"
ADD COLUMN "version_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
