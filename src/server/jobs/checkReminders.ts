import { Queue, Worker } from "bullmq";
import { addDays, addHours } from "date-fns";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { createAdminClient } from "@/lib/supabase/server";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { payments } from "@/server/infrastructure/database/schema/payments";
import { pushNotificationDeliveries } from "@/server/infrastructure/database/schema/pushNotificationDeliveries";
import { pushSubscriptions } from "@/server/infrastructure/database/schema/pushSubscriptions";
import { reminders } from "@/server/infrastructure/database/schema/reminders";
import logger from "@/server/utils/logger";
import {
  generateRemindersForDeliverable,
  generateRemindersForPayment,
} from "@/src/server/domain/services/ReminderGenerator";
import { sendReminderEmail } from "@/src/server/services/email/ResendEmailService";
import {
  buildReminderNotificationPayload,
  isWebPushConfigured,
  sendWebPushNotification,
} from "@/src/server/services/notifications/webPush";

const REMINDER_QUEUE_NAME = "check-reminders";
const REMINDER_JOB_NAME = "check-reminders-hourly";
const REMINDER_CRON = "0 * * * *";
const MAX_EMAILS_PER_RUN = 100;
const RESEND_DAILY_LIMIT = 100;

type CheckRemindersResult = {
  deliverablesScanned: number;
  paymentsScanned: number;
  generatedCount: number;
  insertedCount: number;
  skippedDuplicateCount: number;
  pushAttempted: number;
  pushSent: number;
  pushFailed: number;
  emailsAttempted: number;
  emailsSent: number;
  emailsFailed: number;
  ranAt: string;
};

let reminderQueue: Queue | null = null;
let reminderWorker: Worker | null = null;

function getRedisConnection() {
  const redisUrl = process.env.UPSTASH_REDIS_URL ?? process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("UPSTASH_REDIS_URL or REDIS_URL is required for BullMQ");
  }

  const parsed = new URL(redisUrl);
  const port = Number(
    parsed.port || (parsed.protocol === "rediss:" ? 6380 : 6379),
  );

  return {
    host: parsed.hostname,
    port,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}

function getReminderQueue() {
  if (!reminderQueue) {
    reminderQueue = new Queue(REMINDER_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }

  return reminderQueue;
}

export async function scheduleCheckRemindersJob() {
  const queue = getReminderQueue();

  await queue.add(
    REMINDER_JOB_NAME,
    {},
    {
      jobId: REMINDER_JOB_NAME,
      repeat: {
        pattern: REMINDER_CRON,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );

  logger.info("Scheduled reminders check job", {
    queue: REMINDER_QUEUE_NAME,
    cron: REMINDER_CRON,
  });
}

export function startCheckRemindersWorker() {
  if (reminderWorker) {
    return reminderWorker;
  }

  reminderWorker = new Worker(
    REMINDER_QUEUE_NAME,
    async () => {
      const result = await runCheckRemindersJob();
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  reminderWorker.on("completed", (job, result) => {
    logger.info("Reminder job completed", {
      jobId: job.id,
      result,
    });
  });

  reminderWorker.on("failed", (job, error) => {
    logger.error("Reminder job failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  return reminderWorker;
}

export async function enqueueCheckRemindersJob() {
  const queue = getReminderQueue();
  const job = await queue.add(
    REMINDER_JOB_NAME,
    {},
    {
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );

  logger.info("Enqueued reminders check job", {
    queue: REMINDER_QUEUE_NAME,
    jobId: job.id,
  });

  return {
    queue: REMINDER_QUEUE_NAME,
    jobId: String(job.id),
  };
}

function canProcessReminderEmails() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export async function runCheckRemindersJob(): Promise<CheckRemindersResult> {
  const now = new Date();
  const next24Hours = addHours(now, 24);
  const threeDaysAgo = addDays(now, -3);
  const sevenDaysAgo = addDays(now, -7);
  const failedRetryThreshold = addHours(now, -1);

  logger.info("Running reminders check", {
    ranAt: now.toISOString(),
  });

  try {
    const [deliverableRows, overduePayments, postedByDeal] = await Promise.all([
      db
        .select({
          id: deliverables.id,
          dealId: deliverables.dealId,
          scheduledAt: deliverables.scheduledAt,
          postedAt: deliverables.postedAt,
        })
        .from(deliverables)
        .where(
          and(
            isNotNull(deliverables.scheduledAt),
            gte(deliverables.scheduledAt, now),
            lte(deliverables.scheduledAt, next24Hours),
            isNull(deliverables.postedAt),
            ne(deliverables.status, "CANCELLED"),
          ),
        ),
      db
        .select({
          id: payments.id,
          dealId: payments.dealId,
          expectedDate: payments.expectedDate,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .where(
          and(
            isNull(payments.paidAt),
            isNotNull(payments.expectedDate),
            lte(payments.expectedDate, threeDaysAgo),
          ),
        ),
      db
        .select({
          dealId: deliverables.dealId,
          latestPostedAt: sql<Date>`max(${deliverables.postedAt})`,
        })
        .from(deliverables)
        .where(
          and(
            isNotNull(deliverables.postedAt),
            lte(deliverables.postedAt, sevenDaysAgo),
            ne(deliverables.status, "CANCELLED"),
          ),
        )
        .groupBy(deliverables.dealId),
    ]);

    const postedByDealMap = new Map(
      postedByDeal
        .filter((row) => row.latestPostedAt !== null)
        .map((row) => [row.dealId, row.latestPostedAt as Date]),
    );

    const deliverableReminders = deliverableRows.flatMap((deliverable) =>
      generateRemindersForDeliverable({
        id: deliverable.id,
        deal_id: deliverable.dealId,
        scheduled_at: deliverable.scheduledAt,
        posted_at: deliverable.postedAt,
        now,
      }),
    );

    const paymentReminders = overduePayments.flatMap((payment) =>
      generateRemindersForPayment({
        id: payment.id,
        deal_id: payment.dealId,
        paid_at: payment.paidAt,
        expected_date: payment.expectedDate,
        posted_at: postedByDealMap.get(payment.dealId) ?? null,
        now,
      }),
    );

    const generated = [...deliverableReminders, ...paymentReminders];
    const uniqueKeys = [...new Set(generated.map((item) => item.dedupe_key))];

    let insertedCount = 0;
    let skippedDuplicateCount = 0;
    let pushAttempted = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let emailsAttempted = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    if (uniqueKeys.length > 0) {
      const existingKeys = await db
        .select({
          dedupeKey: reminders.dedupeKey,
        })
        .from(reminders)
        .where(inArray(reminders.dedupeKey, uniqueKeys));

      const existingSet = new Set(existingKeys.map((row) => row.dedupeKey));
      const toInsert = generated.filter(
        (item) => !existingSet.has(item.dedupe_key),
      );
      skippedDuplicateCount = generated.length - toInsert.length;

      if (toInsert.length > 0) {
        const inserted = await db
          .insert(reminders)
          .values(
            toInsert.map((item) => ({
              dealId: item.deal_id,
              deliverableId: item.deliverable_id,
              reason: item.reason,
              dueAt: item.due_at,
              priority: item.priority,
              status: item.status,
              deliveryMethod: item.delivery_method,
              deliveryStatus: item.delivery_status,
              dedupeKey: item.dedupe_key,
            })),
          )
          .onConflictDoNothing({
            target: reminders.dedupeKey,
          })
          .returning({
            id: reminders.id,
          });

        insertedCount = inserted.length;
      }
    }

    if (isWebPushConfigured()) {
      const dueReminders = await db.query.reminders.findMany({
        where: and(eq(reminders.status, "OPEN"), lte(reminders.dueAt, now)),
        with: {
          deal: {
            columns: {
              id: true,
              userId: true,
              title: true,
            },
          },
          deliverable: {
            columns: {
              id: true,
            },
          },
        },
        orderBy: [asc(reminders.dueAt)],
        limit: 200,
      });

      const subscriptionsByUser = new Map<
        string,
        Array<{
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        }>
      >();

      for (const reminder of dueReminders) {
        let subscriptions = subscriptionsByUser.get(reminder.deal.userId);
        if (!subscriptions) {
          subscriptions = await db
            .select({
              id: pushSubscriptions.id,
              endpoint: pushSubscriptions.endpoint,
              p256dh: pushSubscriptions.p256dh,
              auth: pushSubscriptions.auth,
            })
            .from(pushSubscriptions)
            .where(
              and(
                eq(pushSubscriptions.userId, reminder.deal.userId),
                eq(pushSubscriptions.isActive, true),
              ),
            );
          subscriptionsByUser.set(reminder.deal.userId, subscriptions);
        }

        if (subscriptions.length === 0) {
          continue;
        }

        for (const subscription of subscriptions) {
          const [existingDelivery] = await db
            .select({ id: pushNotificationDeliveries.id })
            .from(pushNotificationDeliveries)
            .where(
              and(
                eq(pushNotificationDeliveries.reminderId, reminder.id),
                eq(pushNotificationDeliveries.subscriptionId, subscription.id),
                eq(pushNotificationDeliveries.scheduledFor, reminder.dueAt),
              ),
            )
            .limit(1);

          if (existingDelivery) {
            continue;
          }

          pushAttempted += 1;

          try {
            const payload = buildReminderNotificationPayload({
              reminderId: reminder.id,
              dealId: reminder.dealId,
              deliverableId: reminder.deliverableId,
              reason: reminder.reason,
              dueAt: reminder.dueAt,
              priority: reminder.priority,
              dealTitle: reminder.deal.title,
            });

            await sendWebPushNotification({
              subscription: {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
            });

            await db.insert(pushNotificationDeliveries).values({
              reminderId: reminder.id,
              subscriptionId: subscription.id,
              scheduledFor: reminder.dueAt,
              status: "SENT",
            });

            pushSent += 1;
          } catch (pushError) {
            pushFailed += 1;

            const errorMessage =
              pushError instanceof Error
                ? pushError.message
                : "Unknown push error";

            await db
              .insert(pushNotificationDeliveries)
              .values({
                reminderId: reminder.id,
                subscriptionId: subscription.id,
                scheduledFor: reminder.dueAt,
                status: "FAILED",
                error: errorMessage.slice(0, 500),
              })
              .onConflictDoNothing({
                target: [
                  pushNotificationDeliveries.reminderId,
                  pushNotificationDeliveries.subscriptionId,
                  pushNotificationDeliveries.scheduledFor,
                ],
              });

            if (errorMessage.includes("410") || errorMessage.includes("404")) {
              await db
                .update(pushSubscriptions)
                .set({
                  isActive: false,
                  updatedAt: new Date(),
                })
                .where(eq(pushSubscriptions.id, subscription.id));
            }

            logger.error("Reminder push send failed", {
              reminderId: reminder.id,
              subscriptionId: subscription.id,
              error: errorMessage,
            });
          }
        }
      }
    } else {
      logger.warn("Skipping web push delivery because VAPID is not configured");
    }

    if (canProcessReminderEmails()) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      const sentTodayRows = await db
        .select({
          id: reminders.id,
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.deliveryStatus, "SENT"),
            gte(reminders.updatedAt, dayStart),
          ),
        );

      const remainingDailyQuota = Math.max(
        0,
        RESEND_DAILY_LIMIT - sentTodayRows.length,
      );
      const sendLimit = Math.min(MAX_EMAILS_PER_RUN, remainingDailyQuota);

      if (sendLimit <= 0) {
        logger.warn("Skipping reminder email delivery due to daily send cap", {
          dailyLimit: RESEND_DAILY_LIMIT,
          sentToday: sentTodayRows.length,
        });
      }

      const pendingEmailReminders =
        sendLimit > 0
          ? await db.query.reminders.findMany({
              where: and(
                eq(reminders.status, "OPEN"),
                or(
                  eq(reminders.deliveryStatus, "PENDING"),
                  and(
                    eq(reminders.deliveryStatus, "FAILED"),
                    lte(reminders.updatedAt, failedRetryThreshold),
                  ),
                ),
                lte(reminders.dueAt, now),
              ),
              with: {
                deal: {
                  columns: {
                    id: true,
                    userId: true,
                    title: true,
                  },
                },
                deliverable: {
                  columns: {
                    id: true,
                    platform: true,
                    type: true,
                  },
                },
              },
              orderBy: [asc(reminders.dueAt)],
              limit: sendLimit,
            })
          : [];

      if (pendingEmailReminders.length > 0) {
        const adminClient = createAdminClient();
        const userEmailCache = new Map<string, string>();

        for (const reminder of pendingEmailReminders) {
          emailsAttempted += 1;

          try {
            let email = userEmailCache.get(reminder.deal.userId);
            if (!email) {
              const { data, error } = await adminClient.auth.admin.getUserById(
                reminder.deal.userId,
              );

              if (error || !data.user?.email) {
                throw new Error(
                  error?.message || "Could not resolve recipient email",
                );
              }

              email = data.user.email;
              userEmailCache.set(reminder.deal.userId, email);
            }

            await sendReminderEmail(
              {
                id: reminder.id,
                deal_id: reminder.dealId,
                deliverable_id: reminder.deliverableId,
                reason: reminder.reason,
                due_at: reminder.dueAt,
                dedupe_key: reminder.dedupeKey,
                deal_title: reminder.deal.title,
                deliverable_platform: reminder.deliverable?.platform ?? null,
                deliverable_type: reminder.deliverable?.type ?? null,
              },
              {
                id: reminder.deal.userId,
                email,
              },
            );

            await db
              .update(reminders)
              .set({
                deliveryStatus: "SENT",
                updatedAt: new Date(),
              })
              .where(eq(reminders.id, reminder.id));

            emailsSent += 1;
          } catch (sendError) {
            emailsFailed += 1;

            await db
              .update(reminders)
              .set({
                deliveryStatus: "FAILED",
                updatedAt: new Date(),
              })
              .where(eq(reminders.id, reminder.id));

            logger.error("Reminder email send failed", {
              reminderId: reminder.id,
              dedupeKey: reminder.dedupeKey,
              error:
                sendError instanceof Error
                  ? sendError.message
                  : "Unknown email error",
            });
          }
        }
      }
    } else {
      logger.warn("Skipping reminder email delivery due to missing env vars", {
        hasResendKey: Boolean(process.env.RESEND_API_KEY),
        hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      });
    }

    const result: CheckRemindersResult = {
      deliverablesScanned: deliverableRows.length,
      paymentsScanned: overduePayments.length,
      generatedCount: generated.length,
      insertedCount,
      skippedDuplicateCount,
      pushAttempted,
      pushSent,
      pushFailed,
      emailsAttempted,
      emailsSent,
      emailsFailed,
      ranAt: now.toISOString(),
    };

    logger.info("Reminders check complete", result);
    return result;
  } catch (error) {
    logger.error("Reminders check failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
