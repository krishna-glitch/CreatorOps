"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

type NotificationActionData = {
  dealId?: string | null;
  reminderId?: string | null;
  paymentId?: string | null;
};

export function NotificationMessageHandler() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateStatusMutation = trpc.deals.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.deals.list.invalidate();
      await utils.analytics.getDashboardStats.invalidate();
    },
  });

  const markReminderDoneMutation = trpc.reminders.markDone.useMutation({
    onSuccess: async () => {
      await utils.reminders.listOpen.invalidate();
    },
  });

  const snoozeReminderMutation = trpc.reminders.snooze.useMutation({
    onSuccess: async () => {
      await utils.reminders.listOpen.invalidate();
    },
  });

  const markPostedMutation = trpc.reminders.markPosted.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reminders.listOpen.invalidate(),
        utils.deliverables.listByDeal.invalidate(),
        utils.calendar.getEvents.invalidate(),
      ]);
    },
  });

  const executeAction = useCallback(
    async (action: string, data: NotificationActionData) => {
      try {
        switch (action) {
          case "mark_paid":
            if (data.dealId) {
              await updateStatusMutation.mutateAsync({
                id: data.dealId,
                status: "PAID",
              });
              toast.success("Deal marked as paid! 💰");
            }
            break;

          case "mark_posted":
            if (data.reminderId) {
              await markPostedMutation.mutateAsync({ id: data.reminderId });
              toast.success("Deliverable marked posted.");
            }
            break;
          case "mark_done":
            if (data.reminderId) {
              await markReminderDoneMutation.mutateAsync({
                id: data.reminderId,
              });
              toast.success("Action completed! ✓");
            }
            break;

          case "snooze":
            if (data.reminderId) {
              await snoozeReminderMutation.mutateAsync({ id: data.reminderId });
              toast.success("Snoozed for 24 hours ⏰");
            }
            break;
        }
      } catch (error) {
        console.error("Action execution failed:", error);
        toast.error("Could not complete action.");
      }
    },
    [
      updateStatusMutation,
      markReminderDoneMutation,
      snoozeReminderMutation,
      markPostedMutation,
    ],
  );

  // 1. Listen for real-time messages from SW
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "NOTIFICATION_ACTION") return;
      const { action, data } = event.data;
      void executeAction(action, data);
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [executeAction]);

  // 2. Handle actions from URL params (if app was closed)
  useEffect(() => {
    const action = searchParams.get("notif_action");
    if (action) {
      const data: NotificationActionData = {
        dealId: searchParams.get("dealId"),
        reminderId: searchParams.get("reminderId"),
        paymentId: searchParams.get("paymentId"),
      };

      void executeAction(action, data);

      // Clean up URL params without affecting navigation history state unnecessarily
      const params = new URLSearchParams(searchParams.toString());
      params.delete("notif_action");
      params.delete("dealId");
      params.delete("reminderId");
      params.delete("paymentId");

      const query = params.toString();
      const cleanUrl = query ? `${pathname}?${query}` : pathname;
      router.replace(cleanUrl);
    }
  }, [searchParams, executeAction, router, pathname]);

  return null;
}
