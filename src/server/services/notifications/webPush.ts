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

function hasValue(value: string | undefined | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeBase64Url(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function ensureConfigured() {
  if (configured) {
    return true;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ?? "mailto:support@creatorops.local";

  if (!hasValue(publicKey) || !hasValue(privateKey)) {
    return false;
  }

  const trimmedPublic = (publicKey as string).trim();
  const trimmedPrivate = (privateKey as string).trim();
  if (
    !looksLikeBase64Url(trimmedPublic) ||
    !looksLikeBase64Url(trimmedPrivate)
  ) {
    console.error("Invalid VAPID key format");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, trimmedPublic, trimmedPrivate);
    configured = true;
    return true;
  } catch (error) {
    console.error("Invalid VAPID configuration for web push", error);
    configured = false;
    return false;
  }
}

export function isWebPushConfigured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!hasValue(publicKey) || !hasValue(privateKey)) return false;
  return (
    looksLikeBase64Url((publicKey as string).trim()) &&
    looksLikeBase64Url((privateKey as string).trim())
  );
}

export function getPublicVapidKey() {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    null
  );
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

export function buildReminderNotificationPayload(
  reminder: ReminderPushPayload,
) {
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

  const endpoint = params.subscription.endpoint?.trim();
  const p256dh = params.subscription.keys?.p256dh?.trim();
  const auth = params.subscription.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription payload");
  }

  return webpush.sendNotification(
    {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    },
    JSON.stringify(params.payload),
  );
}
