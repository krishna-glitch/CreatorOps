CREATE TYPE "public"."conflict_severity" AS ENUM('WARN', 'BLOCK');--> statement-breakpoint
CREATE TYPE "public"."conflict_type" AS ENUM('EXCLUSIVITY', 'REVISION_LIMIT', 'APPROVAL_SLA', 'PAYMENT_DISPUTE');--> statement-breakpoint
CREATE TYPE "public"."exclusivity_platform" AS ENUM('INSTAGRAM', 'YOUTUBE', 'TIKTOK');--> statement-breakpoint
CREATE TYPE "public"."exclusivity_region" AS ENUM('US', 'IN', 'GLOBAL');--> statement-breakpoint
CREATE TYPE "public"."exclusivity_scope" AS ENUM('EXACT_CATEGORY', 'PARENT_CATEGORY');--> statement-breakpoint

CREATE TABLE "exclusivity_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"category_path" text NOT NULL,
	"scope" "exclusivity_scope" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"platforms" "exclusivity_platform"[] NOT NULL,
	"regions" "exclusivity_region"[] NOT NULL,
	"notes" text,
	CONSTRAINT "exclusivity_rules_start_date_before_end_date_check" CHECK ("exclusivity_rules"."start_date" <= "exclusivity_rules"."end_date")
);
--> statement-breakpoint

CREATE TABLE "conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "conflict_type" NOT NULL,
	"new_deal_or_deliverable_id" uuid NOT NULL,
	"conflicting_rule_id" uuid,
	"overlap" jsonb NOT NULL,
	"severity" "conflict_severity" NOT NULL,
	"suggested_resolutions" text[] NOT NULL,
	"auto_resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint

ALTER TABLE "exclusivity_rules" ADD CONSTRAINT "exclusivity_rules_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_conflicting_rule_id_exclusivity_rules_id_fk" FOREIGN KEY ("conflicting_rule_id") REFERENCES "public"."exclusivity_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "exclusivity_rules_deal_id_idx" ON "exclusivity_rules" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "conflicts_type_idx" ON "conflicts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "conflicts_severity_idx" ON "conflicts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "conflicts_conflicting_rule_id_idx" ON "conflicts" USING btree ("conflicting_rule_id");--> statement-breakpoint
CREATE INDEX "conflicts_new_deal_or_deliverable_id_idx" ON "conflicts" USING btree ("new_deal_or_deliverable_id");
