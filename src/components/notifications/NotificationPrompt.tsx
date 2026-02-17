"use client";

import { useEffect, useState } from "react";
import { Bell, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  requestNotificationPermission, 
  hasAskedForPermission, 
  getStoredPermissionStatus 
} from "@/src/lib/notifications/requestPermission";
import {
  getAppNotificationsEnabled,
  setAppNotificationsEnabled,
} from "@/src/lib/notifications/preferences";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const utils = trpc.useUtils();
  const vapidQuery = trpc.notifications.getVapidPublicKey.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const subscribeMutation = trpc.notifications.subscribe.useMutation({
    onSuccess: async () => {
      await utils.notifications.status.invalidate();
    },
  });

  useEffect(() => {
    setMounted(true);
    if (!getAppNotificationsEnabled()) {
      setShowPrompt(false);
      setIsDenied(false);
      return;
    }

    // Logic: Only show if we haven't asked before and permission is still 'default'
    // Delay by 30 seconds to wait for user engagement
    const timer = setTimeout(() => {
      const currentPermission = getStoredPermissionStatus();
      
      if (!hasAskedForPermission() && currentPermission === "default") {
        setShowPrompt(true);
      } else if (currentPermission === "denied") {
        setIsDenied(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  async function handleEnable() {
    if (isEnabling) return;
    setIsEnabling(true);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service worker is not supported on this browser.");
      }

      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setIsDenied(permission === "denied");
        if (permission === "denied") {
          toast.error("Notifications are blocked. Enable them in browser settings.");
        }
        return;
      }

      const publicKey = vapidQuery.data?.publicKey;
      if (!publicKey) {
        toast.error("Push key not configured. Ask admin to set VAPID keys.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const raw = subscription.toJSON();
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
        throw new Error("Invalid push subscription payload.");
      }

      await subscribeMutation.mutateAsync({
        endpoint: raw.endpoint,
        keys: {
          p256dh: raw.keys.p256dh,
          auth: raw.keys.auth,
        },
      });

      localStorage.setItem("notification-permission-asked", "true");
      localStorage.setItem("notification-permission-granted", "true");
      setAppNotificationsEnabled(true);
      setShowPrompt(false);
      setIsDenied(false);
      toast.success("Notifications enabled.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not enable notifications.";
      toast.error(message);
    } finally {
      setIsEnabling(false);
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false);
    // Mark as asked so we don't nag them every time, but maybe remind them in 7 days
    localStorage.setItem("notification-permission-asked", "true");
  };

  return (
    <AnimatePresence>
      {isDenied && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-[var(--z-prompt)] md:bottom-8 md:right-8 md:left-auto md:w-96"
        >
          <div className="overflow-hidden rounded-2xl border bg-white p-5 shadow-2xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <Info className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Notifications are blocked
                </h3>
                <p className="text-sm text-muted-foreground">
                  Open your browser site settings and allow notifications for this app, then refresh.
                </p>
              </div>
              <button
                onClick={() => setIsDenied(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-[var(--z-prompt)] md:bottom-8 md:right-8 md:left-auto md:w-96"
        >
          <div className="overflow-hidden rounded-2xl border bg-white p-5 shadow-2xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Stay on top of deadlines
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get notified when content is due, payments arrive, and more. Never miss a brand follow-up.
                </p>
              </div>
              <button 
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex gap-3">
              <Button 
                onClick={handleEnable} 
                disabled={isEnabling || subscribeMutation.isPending}
                className="flex-1 dash-shell-primary-btn h-10 rounded-xl font-bold"
              >
                {isEnabling || subscribeMutation.isPending ? "Enabling..." : "Enable"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDismiss}
                className="flex-1 h-10 rounded-xl"
              >
                Not Now
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
