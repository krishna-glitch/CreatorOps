"use client";

import { Bell, Check, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { formatDealDate, formatTime } from "@/src/lib/utils/format-utils";

export function NotificationPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const remindersQuery = trpc.reminders.listOpen.useQuery(undefined, {
    staleTime: 15_000,
  });

  const markDoneMutation = trpc.reminders.markDone.useMutation({
    onSuccess: async () => {
      await utils.reminders.listOpen.invalidate();
    },
  });

  const snoozeMutation = trpc.reminders.snooze.useMutation({
    onSuccess: async () => {
      await utils.reminders.listOpen.invalidate();
    },
  });

  const reminders = remindersQuery.data ?? [];
  const hasNotifications = reminders.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "dash-shell-icon-btn relative inline-flex h-9 w-9 items-center justify-center rounded-lg border md:h-8 md:w-8",
            "border-border bg-background shadow-sm",
          )}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 md:h-4 md:w-4" />
          {hasNotifications && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "dash-card z-[var(--z-sheet)] w-80 overflow-hidden rounded-md border p-0 shadow-md",
        )}
      >
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h3 className="font-semibold">Notifications</h3>
            <Badge variant="secondary">{reminders.length}</Badge>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No new notifications
              </div>
            ) : (
              <div className="divide-y">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="group flex flex-col gap-1 p-4 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => {
                          setOpen(false);
                          router.push(`/deals/${reminder.dealId}`);
                        }}
                      >
                        {reminder.reason}
                      </button>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          reminder.priority === "CRITICAL"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-blue-200 bg-blue-50 text-blue-700",
                        )}
                      >
                        {reminder.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {reminder.dealTitle} · {formatDealDate(reminder.dueAt)}{" "}
                      {formatTime(reminder.dueAt)}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 px-3 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          markDoneMutation.mutate({ id: reminder.id });
                        }}
                        disabled={markDoneMutation.isPending}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Mark Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 px-3 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          snoozeMutation.mutate({ id: reminder.id });
                        }}
                        disabled={snoozeMutation.isPending}
                      >
                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                        Snooze 1d
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </PopoverContent>
    </Popover>
  );
}
