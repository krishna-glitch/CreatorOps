CREATE INDEX IF NOT EXISTS "deals_user_status_created_idx" ON "deals" USING btree ("user_id","status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_user_created_id_pagination_idx" ON "deals" USING btree ("user_id","created_at" DESC,"id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_deal_status_paid_at_idx" ON "payments" USING btree ("deal_id","status","paid_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_deal_status_expected_date_idx" ON "payments" USING btree ("deal_id","status","expected_date");
