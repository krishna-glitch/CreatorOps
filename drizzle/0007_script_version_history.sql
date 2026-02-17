ALTER TABLE IF EXISTS "media_assets"
ADD COLUMN IF NOT EXISTS "script_content" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "media_assets"
ADD COLUMN IF NOT EXISTS "version_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
