"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  amountUsd: number | null;
  exchangeRate: number | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: string | null;
  paymentId?: string;
  size?: "sm" | "md" | "lg";
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatPrimaryAmount(amount: number, currency: string): string {
  if (currency === "INR") {
    return formatINR(amount);
  }

  if (currency === "USD") {
    return formatUSD(amount);
  }

  return formatCurrency(amount, currency);
}

function formatRateLabel(currency: string, rate: number): string {
  if (currency === "INR") {
    return `Rate: ₹${rate.toFixed(2)}/$1`;
  }

  return `Rate: ${currency} ${rate.toFixed(2)}/$1`;
}

function formatRateDateLabel(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const sizeStyles: Record<
  NonNullable<CurrencyDisplayProps["size"]>,
  {
    amount: string;
    conversion: string;
    meta: string;
    button: string;
  }
> = {
  sm: {
    amount: "text-sm font-semibold",
    conversion: "text-sm font-medium text-muted-foreground",
    meta: "text-xs text-muted-foreground",
    button: "h-7 px-2 text-xs",
  },
  md: {
    amount: "text-base font-semibold",
    conversion: "text-sm font-medium text-muted-foreground",
    meta: "text-xs text-muted-foreground",
    button: "h-8 px-2.5 text-xs",
  },
  lg: {
    amount: "text-lg font-semibold",
    conversion: "text-base font-medium text-muted-foreground",
    meta: "text-sm text-muted-foreground",
    button: "h-9 px-3 text-sm",
  },
};

export function CurrencyDisplay({
  amount,
  currency,
  amountUsd,
  exchangeRate,
  exchangeRateDate,
  exchangeRateSource,
  paymentId,
  size = "md",
}: CurrencyDisplayProps) {
  const styles = sizeStyles[size];
  const hasConversion = amountUsd !== null;
  const canAddRate = Boolean(paymentId && amountUsd === null);
  const isUsd = currency === "USD";
  const showRateMeta = !isUsd && hasConversion && exchangeRate !== null;
  const formattedPrimaryAmount = formatPrimaryAmount(amount, currency);
  const formattedUsdAmount = hasConversion ? formatUSD(amountUsd) : null;
  const rateDateLabel = formatRateDateLabel(exchangeRateDate);
  const isManualRate = exchangeRateSource === "manual";

  if (isUsd) {
    return (
      <div className="flex items-center">
        <span className={styles.amount}>{formattedPrimaryAmount} USD</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span className={styles.amount}>
          {formattedPrimaryAmount} {currency}
        </span>
        {formattedUsdAmount ? (
          <span className={styles.conversion}>≈ {formattedUsdAmount} USD</span>
        ) : null}
      </div>

      {showRateMeta ? (
        <div className={cn("flex flex-wrap items-center gap-1.5", styles.meta)}>
          <span>{formatRateLabel(currency, exchangeRate)}</span>
          <span>·</span>
          <span>{isManualRate ? "Manual" : rateDateLabel}</span>
          <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted-foreground"
                  aria-label="Exchange rate info"
                >
                  i
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  sideOffset={8}
                  className="z-50 max-w-[260px] rounded-md border border-border bg-background p-2 text-xs text-foreground shadow-md"
                >
                  <p>Exchange rate source: European Central Bank</p>
                  <p>via Frankfurter API</p>
                  <p>Reference rate (mid-market)</p>
                  <p>Actual received amount may vary 0.1-3%</p>
                  <p>depending on payment method used</p>
                  <Tooltip.Arrow className="fill-background" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      ) : (
        <div className={cn("flex flex-wrap items-center gap-2", styles.meta)}>
          {canAddRate ? (
            <span>Auto-conversion unavailable</span>
          ) : (
            <span>USD equivalent shown when paid</span>
          )}
          {canAddRate ? (
            <Button
              type="button"
              variant="outline"
              className={styles.button}
              data-payment-id={paymentId}
            >
              Add Rate
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
