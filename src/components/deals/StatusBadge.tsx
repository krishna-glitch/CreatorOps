import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const dealStatusClassName: Record<string, string> = {
  INBOUND:
    "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  NEGOTIATING:
    "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  AGREED:
    "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  PAID:
    "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

type StatusBadgeProps = {
  status: string | null;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status ?? "UNKNOWN";

  return (
    <Badge
      className={cn(
        dealStatusClassName[normalizedStatus] ??
          "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
        className,
      )}
    >
      {normalizedStatus}
    </Badge>
  );
}

type FormatCurrencyOptions = {
  currency: string | null;
  locale?: string;
};

export function formatDealCurrency(
  value: string | number | null,
  options: FormatCurrencyOptions,
) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return `${options.currency ?? ""} ${value}`.trim();
  }

  if (!options.currency) {
    return new Intl.NumberFormat(options.locale).format(numericValue);
  }

  return new Intl.NumberFormat(options.locale, {
    style: "currency",
    currency: options.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function formatDealDate(
  value: Date | string,
  locale?: string,
  includeTime = false,
) {
  const parsed = typeof value === "string" ? new Date(value) : value;

  const options: Intl.DateTimeFormatOptions = includeTime
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

  return new Intl.DateTimeFormat(locale, options).format(parsed);
}
