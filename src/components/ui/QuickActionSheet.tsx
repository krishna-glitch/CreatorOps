"use client";

import React from "react";
import { BottomSheet } from "./BottomSheet";
import { CheckCircle2, XCircle, Clock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dealTitle: string;
  onAction: (action: "PAID" | "CANCELLED" | "SNOOZE") => void;
}

export function QuickActionSheet({
  isOpen,
  onClose,
  dealTitle,
  onAction,
}: QuickActionSheetProps) {
  const actions = [
    {
      id: "PAID",
      label: "Mark as Paid",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
      description: "Confirm payment has been received",
    },
    {
      id: "SNOOZE",
      label: "Snooze 1 Day",
      icon: Clock,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
      description: "Move follow-up to tomorrow",
    },
    {
      id: "CANCELLED",
      label: "Cancel Deal",
      icon: XCircle,
      color: "text-red-600 bg-red-50 dark:bg-red-900/20",
      description: "Archive this deal as cancelled",
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Quick Actions">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Update status for <span className="font-medium text-foreground">{dealTitle}</span>
        </p>
        
        <div className="grid gap-3">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onAction(action.id as any);
                onClose();
              }}
              className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all active:scale-[0.98] active:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
            >
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", action.color)}>
                <action.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-2xl py-4 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
