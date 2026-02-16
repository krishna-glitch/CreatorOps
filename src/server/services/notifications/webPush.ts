import webpush from "web-push";

type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type ReminderPushPayload = {
  reminderId: string;
  dealId: string;
  deliverableId: string | null;
  reason: string;
  dueAt: Date;
  priority: string;
  dealTitle: string;
};

let configured = false;

function ensureConfigured() {
  if (configured) {
    return true;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@creatorops.local";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isWebPushConfigured() {
  return ensureConfigured();
}

export function getPublicVapidKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null;
}

function getPriorityTone(priority: string) {
  if (priority === "CRITICAL" || priority === "HIGH") {
    return {
      title: "Urgent Reminder",
      requireInteraction: true,
    };
  }

  return {
    title: "CreatorOps Reminder",
    requireInteraction: false,
  };
}

export function buildReminderNotificationPayload(reminder: ReminderPushPayload) {
  const tone = getPriorityTone(reminder.priority);
  const actions =
    reminder.deliverableId !== null
      ? [
          { action: "open", title: "Open" },
          { action: "mark_posted", title: "Mark Posted" },
          { action: "snooze", title: "Snooze 1d" },
          { action: "dismiss", title: "Dismiss" },
        ]
      : [
          { action: "open", title: "Open" },
          { action: "snooze", title: "Snooze 1d" },
          { action: "dismiss", title: "Dismiss" },
        ];

  return {
    title: tone.title,
    body: `${reminder.reason} • ${reminder.dealTitle}`,
    tag: `reminder:${reminder.reminderId}:${reminder.dueAt.toISOString()}`,
    priority:
      reminder.priority === "CRITICAL" || reminder.priority === "HIGH"
        ? "high"
        : "normal",
    data: {
      url: `/deals/${reminder.dealId}`,
      reminderId: reminder.reminderId,
      dealId: reminder.dealId,
      deliverableId: reminder.deliverableId,
    },
    actions,
    requireInteraction: tone.requireInteraction,
  };
}

export async function sendWebPushNotification(params: {
  subscription: PushSubscriptionInput;
  payload: Record<string, unknown>;
}) {
  if (!ensureConfigured()) {
    throw new Error("Web push is not configured");
  }

  return webpush.sendNotification(
    {
      endpoint: params.subscription.endpoint,
      keys: params.subscription.keys,
    },
    JSON.stringify(params.payload),
  );
}
