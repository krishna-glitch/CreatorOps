ALTER TABLE "deals"
ADD COLUMN "revision_limit" integer DEFAULT 2 NOT NULL,
ADD COLUMN "revisions_used" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rework_cycles"
ADD COLUMN "exceeds_contract_limit" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_revision_limit_positive_check" CHECK ("deals"."revision_limit" >= 1);
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_revisions_used_non_negative_check" CHECK ("deals"."revisions_used" >= 0);
--> statement-breakpoint
CREATE INDEX "deals_revisions_used_idx" ON "deals" USING btree ("revisions_used");
