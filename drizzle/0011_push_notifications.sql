CREATE TYPE "public"."push_delivery_status" AS ENUM('SENT', 'FAILED');

CREATE TABLE "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "push_notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reminder_id" uuid NOT NULL,
  "subscription_id" uuid NOT NULL,
  "scheduled_for" timestamp NOT NULL,
  "status" "push_delivery_status" NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_user_id_auth_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "push_notification_deliveries"
  ADD CONSTRAINT "push_notification_deliveries_reminder_id_reminders_id_fk"
  FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "push_notification_deliveries"
  ADD CONSTRAINT "push_notification_deliveries_subscription_id_push_subscriptions_id_fk"
  FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique_idx" ON "push_subscriptions" USING btree ("endpoint");
CREATE INDEX "push_subscriptions_user_active_idx" ON "push_subscriptions" USING btree ("user_id", "is_active");
CREATE UNIQUE INDEX "push_delivery_reminder_subscription_scheduled_unique_idx" ON "push_notification_deliveries" USING btree ("reminder_id", "subscription_id", "scheduled_for");
CREATE INDEX "push_delivery_reminder_idx" ON "push_notification_deliveries" USING btree ("reminder_id");
CREATE INDEX "push_delivery_subscription_idx" ON "push_notification_deliveries" USING btree ("subscription_id");
