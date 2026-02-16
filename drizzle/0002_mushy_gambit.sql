CREATE TYPE "public"."feedback_type" AS ENUM('CREATIVE_DIRECTION', 'COMPLIANCE', 'BRAND_VOICE', 'EDITING', 'COPY', 'TIMING', 'TECHNICAL', 'OTHER');
--> statement-breakpoint
CREATE TYPE "public"."feedback_sentiment" AS ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'FRUSTRATED');
--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED');
--> statement-breakpoint
CREATE TABLE "feedback_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"deliverable_id" uuid,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"feedback_type" "feedback_type" NOT NULL,
	"severity" integer NOT NULL,
	"sentiment" "feedback_sentiment" NOT NULL,
	"message_raw" text NOT NULL,
	"summary" text,
	"status" "feedback_status" DEFAULT 'OPEN' NOT NULL,
	"resolution_notes" text,
	"time_spent_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rework_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"request_summary" text NOT NULL,
	"what_changed" text,
	"client_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rework_cycles" ADD CONSTRAINT "rework_cycles_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_items_deal_id_idx" ON "feedback_items" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "feedback_items_deliverable_id_idx" ON "feedback_items" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "feedback_items_received_at_idx" ON "feedback_items" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "feedback_items_feedback_type_idx" ON "feedback_items" USING btree ("feedback_type");--> statement-breakpoint
CREATE INDEX "feedback_items_status_idx" ON "feedback_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rework_cycles_deliverable_id_idx" ON "rework_cycles" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "rework_cycles_cycle_number_idx" ON "rework_cycles" USING btree ("cycle_number");--> statement-breakpoint
CREATE INDEX "rework_cycles_requested_at_idx" ON "rework_cycles" USING btree ("requested_at");
