ALTER TABLE "rework_cycles"
ADD COLUMN "time_spent_minutes" integer;
--> statement-breakpoint
ALTER TABLE "rework_cycles" ADD CONSTRAINT "rework_cycles_time_spent_non_negative_check" CHECK ("rework_cycles"."time_spent_minutes" is null or "rework_cycles"."time_spent_minutes" >= 0);
