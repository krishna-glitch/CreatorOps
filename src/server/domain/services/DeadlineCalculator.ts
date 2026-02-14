import { addHours, differenceInHours, isAfter, isBefore } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type DeadlineState =
  | "COMPLETED"
  | "ON_TRACK"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "LATE"
  | "LATE_1D"
  | "LATE_3D";

export type DeadlineCalculationInput = {
  scheduled_at: Date | string | null;
  posted_at: Date | string | null;
  now: Date | string;
  timezone?: string;
};

export type DeadlineCalculationResult = {
  deadline_state: DeadlineState;
  deadline_state_reason: string;
};

export function calculateDeadlineState(
  input: DeadlineCalculationInput
): DeadlineCalculationResult {
  const now = toDate(input.now);
  const postedAt = toOptionalDate(input.posted_at);
  const scheduledAt = toOptionalDate(input.scheduled_at);
  const timezone = input.timezone ?? "UTC";

  if (postedAt) {
    return {
      deadline_state: "COMPLETED",
      deadline_state_reason: "Deliverable has been posted",
    };
  }

  if (!scheduledAt) {
    return {
      deadline_state: "ON_TRACK",
      deadline_state_reason: "No deadline set",
    };
  }

  if (isAfter(now, scheduledAt)) {
    const late24h = addHours(scheduledAt, 24);
    const late72h = addHours(scheduledAt, 72);

    if (!isAfter(now, late24h)) {
      return {
        deadline_state: "LATE",
        deadline_state_reason: `Overdue by ${formatRelativeDuration(scheduledAt, now)}`,
      };
    }

    if (!isAfter(now, late72h)) {
      return {
        deadline_state: "LATE_1D",
        deadline_state_reason: `Overdue by ${formatRelativeDuration(scheduledAt, now)}`,
      };
    }

    return {
      deadline_state: "LATE_3D",
      deadline_state_reason: `Overdue by ${formatRelativeDuration(scheduledAt, now)}`,
    };
  }

  if (isSameDayInTimezone(now, scheduledAt, timezone)) {
    return {
      deadline_state: "DUE_TODAY",
      deadline_state_reason: `Due in ${formatRelativeDuration(now, scheduledAt)}`,
    };
  }

  const dueSoonThreshold = addHours(scheduledAt, -24);
  if (!isBefore(now, dueSoonThreshold)) {
    return {
      deadline_state: "DUE_SOON",
      deadline_state_reason: `Due in ${formatRelativeDuration(now, scheduledAt)}`,
    };
  }

  return {
    deadline_state: "ON_TRACK",
    deadline_state_reason: `Due in ${formatRelativeDuration(now, scheduledAt)}`,
  };
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date input");
  }
  return date;
}

function toOptionalDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }
  return toDate(value);
}

function isSameDayInTimezone(a: Date, b: Date, timezone: string) {
  return (
    formatInTimeZone(a, timezone, "yyyy-MM-dd") ===
    formatInTimeZone(b, timezone, "yyyy-MM-dd")
  );
}

function formatRelativeDuration(from: Date, to: Date) {
  const hours = Math.max(1, Math.abs(differenceInHours(to, from)));
  const days = Math.floor(hours / 24);

  if (days >= 2) {
    return `${days} days`;
  }

  if (hours >= 24) {
    return "1 day";
  }

  return `${hours} hours`;
}
