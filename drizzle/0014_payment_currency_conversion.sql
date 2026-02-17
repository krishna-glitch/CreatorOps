ALTER TABLE "payments" ADD COLUMN "amount_usd" decimal(12, 2);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate" decimal(10, 6);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate_date" date;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate_source" varchar(50);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate_manual" decimal(10, 6);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "exchange_rate_manual_note" text;
