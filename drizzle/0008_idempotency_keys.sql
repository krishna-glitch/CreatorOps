CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text NOT NULL,
  "state" text DEFAULT 'IN_PROGRESS' NOT NULL,
  "response_status" integer,
  "response_body" text,
  "response_content_type" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp DEFAULT now() + interval '24 hours' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_user_endpoint_key_uidx" ON "idempotency_keys" USING btree ("user_id","endpoint","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");
