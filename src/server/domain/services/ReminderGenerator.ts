import { addDays, addHours, isAfter, isBefore } from "date-fns";
import { calculateDeadlineState } from "./DeadlineCalculator";

export type ReminderPriority = "LOW" | "MED" | "HIGH" | "CRITICAL";
export type ReminderStatus = "OPEN" | "DONE" | "SNOOZED" | "CANCELLED";
export type ReminderDeliveryMethod = "EMAIL";
export type ReminderDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export type GeneratedReminder = {
  deal_id: string;
  deliverable_id: string | null;
  reason: string;
  due_at: Date;
  priority: ReminderPriority;
  status: ReminderStatus;
  delivery_method: ReminderDeliveryMethod;
  delivery_status: ReminderDeliveryStatus;
  dedupe_key: string;
};

export type DeliverableReminderInput = {
  id: string;
  deal_id: string;
  scheduled_at: Date | string | null;
  posted_at: Date | string | null;
  now?: Date | string;
  timezone?: string;
};

export type PaymentReminderInput = {
  id: string;
  deal_id: string;
  paid_at?: Date | string | null;
  invoice_sent_at?: Date | string | null;
  posted_at?: Date | string | null;
  expected_date?: Date | string | null;
  now?: Date | string;
};

export function generateRemindersForDeliverable(
  deliverable: DeliverableReminderInput,
): GeneratedReminder[] {
  const now = toDate(deliverable.now ?? new Date());
  const scheduledAt = toOptionalDate(deliverable.scheduled_at);
  const postedAt = toOptionalDate(deliverable.posted_at);
  const reminders: GeneratedReminder[] = [];
  const dedupe = new Set<string>();

  if (!scheduledAt || postedAt) {
    return reminders;
  }

  const state = calculateDeadlineState({
    scheduled_at: scheduledAt,
    posted_at: postedAt,
    now,
    timezone: deliverable.timezone,
  }).deadline_state;

  // Rule: any future deliverable gets a due-soon reminder at scheduled_at - 24h.
  if (isAfter(scheduledAt, now)) {
    const dueSoonAt = addHours(scheduledAt, -24);
    pushReminder(reminders, dedupe, {
      deal_id: deliverable.deal_id,
      deliverable_id: deliverable.id,
      reason: "Deliverable due within 24 hours",
      due_at: isBefore(dueSoonAt, now) ? now : dueSoonAt,
      priority: "MED",
      status: "OPEN",
      delivery_method: "EMAIL",
      delivery_status: "PENDING",
      dedupe_key: `deliverable:${deliverable.id}:due_soon`,
    });
  }

  // Rule: late deliverable -> immediate high-priority reminder.
  if (state === "LATE" || state === "LATE_1D" || state === "LATE_3D") {
    pushReminder(reminders, dedupe, {
      deal_id: deliverable.deal_id,
      deliverable_id: deliverable.id,
      reason: "Deliverable is overdue",
      due_at: now,
      priority: "HIGH",
      status: "OPEN",
      delivery_method: "EMAIL",
      delivery_status: "PENDING",
      dedupe_key: `deliverable:${deliverable.id}:overdue`,
    });
  }

  return reminders;
}

export function generateRemindersForPayment(
  payment: PaymentReminderInput,
): GeneratedReminder[] {
  const now = toDate(payment.now ?? new Date());
  const paidAt = toOptionalDate(payment.paid_at);
  const invoiceSentAt = toOptionalDate(payment.invoice_sent_at);
  const postedAt = toOptionalDate(payment.posted_at);
  const expectedDate = toOptionalDate(payment.expected_date);
  const reminders: GeneratedReminder[] = [];
  const dedupe = new Set<string>();

  if (paidAt) {
    return reminders;
  }

  // Fallback: if invoice_sent_at is absent, expected_date can represent invoice tracking date.
  const invoiceReference = invoiceSentAt ?? expectedDate;
  const isInvoiceOver3Days =
    invoiceReference !== null && !isBefore(now, addDays(invoiceReference, 3));
  const isPostedOver7Days =
    postedAt !== null && !isBefore(now, addDays(postedAt, 7));

  if (isInvoiceOver3Days || isPostedOver7Days) {
    const reason = isPostedOver7Days
      ? "Payment still unpaid 7+ days after posting"
      : "Invoice sent 3+ days ago and still unpaid";

    pushReminder(reminders, dedupe, {
      deal_id: payment.deal_id,
      deliverable_id: null,
      reason,
      due_at: now,
      priority: "HIGH",
      status: "OPEN",
      delivery_method: "EMAIL",
      delivery_status: "PENDING",
      dedupe_key: `payment:${payment.id}:overdue`,
    });
  }

  return reminders;
}

function pushReminder(
  reminders: GeneratedReminder[],
  dedupe: Set<string>,
  reminder: GeneratedReminder,
) {
  if (dedupe.has(reminder.dedupe_key)) {
    return;
  }

  dedupe.add(reminder.dedupe_key);
  reminders.push(reminder);
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date input");
  }
  return date;
}

function toOptionalDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return toDate(value);
}
