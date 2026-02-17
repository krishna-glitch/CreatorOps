import { format } from "date-fns";
import { Resend } from "resend";

export type ReminderEmailUser = {
  id: string;
  email: string;
  full_name?: string | null;
};

export type ReminderEmailPayload = {
  id: string;
  deal_id: string;
  deliverable_id: string | null;
  reason: string;
  due_at: Date | string;
  dedupe_key: string;
  deal_title?: string | null;
  deliverable_platform?: string | null;
  deliverable_type?: string | null;
};

const DEFAULT_FROM_EMAIL = "CreatorOps <noreply@yourdomain.com>";
const DEFAULT_APP_URL = "https://creator-ops-eta.vercel.app";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
}

function toDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid reminder due_at date");
  }
  return date;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTemplateType(reminder: ReminderEmailPayload) {
  if (
    reminder.dedupe_key.includes("deliverable:") &&
    reminder.dedupe_key.includes(":due_soon")
  ) {
    return "DELIVERABLE_DUE_SOON" as const;
  }
  if (
    reminder.dedupe_key.includes("deliverable:") &&
    reminder.dedupe_key.includes(":overdue")
  ) {
    return "DELIVERABLE_OVERDUE" as const;
  }
  return "PAYMENT_OVERDUE" as const;
}

function buildReminderEmail(
  reminder: ReminderEmailPayload,
  user: ReminderEmailUser,
) {
  const type = getTemplateType(reminder);
  const dueAt = toDate(reminder.due_at);
  const dueAtText = format(dueAt, "MMM d, yyyy h:mm a");
  const appBaseUrl = getAppBaseUrl().replace(/\/+$/, "");
  const dealUrl = `${appBaseUrl}/deals/${reminder.deal_id}`;
  const deliverableUrl = reminder.deliverable_id
    ? `${dealUrl}?deliverableId=${reminder.deliverable_id}`
    : dealUrl;
  const recipientName = user.full_name?.trim() || user.email;
  const safeDealTitle = escapeHtml(reminder.deal_title ?? "Untitled deal");
  const safeReason = escapeHtml(reminder.reason);
  const safeContentType = escapeHtml(
    [reminder.deliverable_platform, reminder.deliverable_type]
      .filter(Boolean)
      .join(" · ") || "Deliverable",
  );

  if (type === "DELIVERABLE_DUE_SOON") {
    return {
      subject: "Deliverable Due Soon (24h)",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h2 style="margin-bottom: 8px;">Deliverable Due Soon</h2>
          <p style="margin-top: 0;">Hi ${escapeHtml(recipientName)}, your deliverable is due soon.</p>
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#f9fafb;">
            <p style="margin:0 0 8px;"><strong>Deal:</strong> ${safeDealTitle}</p>
            <p style="margin:0 0 8px;"><strong>Deliverable:</strong> ${safeContentType}</p>
            <p style="margin:0 0 8px;"><strong>Due:</strong> ${escapeHtml(dueAtText)}</p>
            <p style="margin:0;"><strong>Reason:</strong> ${safeReason}</p>
          </div>
          <p style="margin-top:16px;">
            <a href="${deliverableUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Open Deliverable</a>
          </p>
        </div>
      `,
    };
  }

  if (type === "DELIVERABLE_OVERDUE") {
    return {
      subject: "Deliverable Overdue",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h2 style="margin-bottom: 8px; color: #b91c1c;">Deliverable Overdue</h2>
          <p style="margin-top: 0;">Hi ${escapeHtml(recipientName)}, one of your deliverables is overdue.</p>
          <div style="border:1px solid #fecaca;border-radius:12px;padding:16px;background:#fff1f2;">
            <p style="margin:0 0 8px;"><strong>Deal:</strong> ${safeDealTitle}</p>
            <p style="margin:0 0 8px;"><strong>Deliverable:</strong> ${safeContentType}</p>
            <p style="margin:0 0 8px;"><strong>Flagged at:</strong> ${escapeHtml(dueAtText)}</p>
            <p style="margin:0;"><strong>Reason:</strong> ${safeReason}</p>
          </div>
          <p style="margin-top:16px;">
            <a href="${deliverableUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Resolve Now</a>
          </p>
        </div>
      `,
    };
  }

  return {
    subject: "Payment Overdue Reminder",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <h2 style="margin-bottom: 8px; color: #b45309;">Payment Overdue</h2>
        <p style="margin-top: 0;">Hi ${escapeHtml(recipientName)}, a payment follow-up is required.</p>
        <div style="border:1px solid #fcd34d;border-radius:12px;padding:16px;background:#fffbeb;">
          <p style="margin:0 0 8px;"><strong>Deal:</strong> ${safeDealTitle}</p>
          <p style="margin:0 0 8px;"><strong>Flagged at:</strong> ${escapeHtml(dueAtText)}</p>
          <p style="margin:0;"><strong>Reason:</strong> ${safeReason}</p>
        </div>
        <p style="margin-top:16px;">
          <a href="${dealUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Open Deal</a>
        </p>
      </div>
    `,
  };
}

export async function sendReminderEmail(
  reminder: ReminderEmailPayload,
  user: ReminderEmailUser,
) {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const toEmail = process.env.REMINDER_TEST_RECIPIENT_EMAIL ?? user.email;
  const emailContent = buildReminderEmail(reminder, user);

  const response = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (response.error) {
    throw new Error(response.error.message || "Resend send failed");
  }

  return {
    provider: "resend" as const,
    messageId: response.data?.id ?? null,
    subject: emailContent.subject,
    to: toEmail,
  };
}
