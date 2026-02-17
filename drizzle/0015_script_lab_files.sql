CREATE TABLE IF NOT EXISTS "script_lab_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "content_markdown" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "script_lab_files"
  ADD CONSTRAINT "script_lab_files_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "script_lab_files_user_id_idx" ON "script_lab_files" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "script_lab_files_updated_at_idx" ON "script_lab_files" USING btree ("updated_at");
