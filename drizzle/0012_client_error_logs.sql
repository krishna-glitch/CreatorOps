CREATE TABLE "client_error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"pathname" varchar(500),
	"user_agent" text,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "client_error_logs_reported_at_idx" ON "client_error_logs" USING btree ("reported_at");
--> statement-breakpoint
CREATE INDEX "client_error_logs_created_at_idx" ON "client_error_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "client_error_logs_type_idx" ON "client_error_logs" USING btree ("type");
