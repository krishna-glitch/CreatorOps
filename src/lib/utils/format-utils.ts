export function formatDealCurrency(
  value: string | number | null | undefined,
  options: { currency: string | null; locale?: string; compact?: boolean },
) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return `${options.currency ?? ""} ${value}`.trim();
  }

  return new Intl.NumberFormat(options.locale ?? "en-US", {
    style: "currency",
    currency: options.currency ?? "USD",
    notation: options.compact ? "compact" : "standard",
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(numericValue);
}

export function formatDealDate(
  value: Date | string,
  options: { locale?: string; includeTime?: boolean } = {},
) {
  const parsed = typeof value === "string" ? new Date(value) : value;

  const formatOptions: Intl.DateTimeFormatOptions = options.includeTime
    ? {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    : {
        month: "short",
        day: "numeric",
        year: "numeric",
      };

  return new Intl.DateTimeFormat(
    options.locale ?? "en-US",
    formatOptions,
  ).format(parsed);
}

export function formatDayLabel(value: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );

  if (target.getTime() === today.getTime()) {
    return "Today";
  }
  if (target.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

export function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
