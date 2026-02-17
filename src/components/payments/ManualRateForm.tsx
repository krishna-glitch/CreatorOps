"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { BottomSheet } from "@/src/components/ui/BottomSheet";

type ManualRateFormMode = "inline" | "dialog" | "sheet";

interface ManualRateFormProps {
  paymentId: string;
  amount: number;
  currency: string;
  paidAt: Date;
  mode?: ManualRateFormMode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
  onCancel?: () => void;
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

function calculateAmountUsd(
  amount: number,
  currency: string,
  rate: number,
): number {
  if (currency === "USD") {
    return amount;
  }

  return amount / rate;
}

export function ManualRateForm({
  paymentId,
  amount,
  currency,
  paidAt,
  mode = "inline",
  isOpen = true,
  onOpenChange,
  onSaved,
  onCancel,
}: ManualRateFormProps) {
  const [rateInput, setRateInput] = useState("");
  const [note, setNote] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const updateExchangeRateMutation =
    trpc.payments.updateExchangeRate.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.payments.listByDeal.invalidate(),
          utils.analytics.getDashboardStats.invalidate(),
        ]);
        toast.success("Exchange rate updated.");
        onSaved?.();
        onOpenChange?.(false);
      },
      onError: (error) => {
        toast.error(error.message || "Could not save exchange rate.");
      },
    });

  const parsedRate = Number(rateInput);
  const hasValidRate = Number.isFinite(parsedRate) && parsedRate > 0;

  const previewUsd = useMemo(() => {
    if (!hasValidRate) {
      return null;
    }

    return Number(calculateAmountUsd(amount, currency, parsedRate).toFixed(2));
  }, [amount, currency, hasValidRate, parsedRate]);

  const paidOnLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(paidAt);

  const handleClose = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleSubmit = () => {
    if (!hasValidRate) {
      setRateError("Rate must be a positive number greater than 0.");
      return;
    }

    setRateError(null);

    updateExchangeRateMutation.mutate({
      paymentId,
      rate: parsedRate,
      note: note.trim().length > 0 ? note.trim() : undefined,
    });
  };

  const content = (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Add Exchange Rate</h3>
        <p className="text-sm text-muted-foreground">
          Payment: {formatPrimaryAmount(amount, currency)} {currency}
        </p>
        <p className="text-sm text-muted-foreground">Paid on: {paidOnLabel}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-rate-input">1 USD =</Label>
        <div className="flex items-center gap-2">
          <Input
            id="manual-rate-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.000001"
            placeholder="83.24"
            value={rateInput}
            onChange={(event) => {
              setRateInput(event.target.value);
              if (rateError) {
                setRateError(null);
              }
            }}
          />
          <span className="text-sm text-muted-foreground">{currency}</span>
        </div>
        {rateError ? (
          <p className="text-xs font-medium text-destructive">{rateError}</p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Preview</p>
        <p className="text-sm font-medium">
          {previewUsd !== null
            ? `≈ ${formatUSD(previewUsd)} USD`
            : "Enter a valid rate to preview"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-rate-note">Note (optional)</Label>
        <Input
          id="manual-rate-note"
          placeholder="Bank statement showed this rate"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={updateExchangeRateMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          loading={updateExchangeRateMutation.isPending}
        >
          Save Rate
        </Button>
      </DialogFooter>
    </div>
  );

  if (mode === "dialog") {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Exchange Rate</DialogTitle>
            <DialogDescription>
              Add or override the USD conversion rate.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === "sheet") {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Manual Exchange Rate"
        showCloseButton
      >
        {content}
      </BottomSheet>
    );
  }

  return content;
}
