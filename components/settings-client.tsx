"use client";

import {
  Bell,
  Check,
  Cloud,
  Coins,
  Download,
  ExternalLink,
  Info,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";
import { usePWA } from "@/src/hooks/usePWA";
import {
  getAppNotificationsEnabled,
  setAppNotificationsEnabled,
} from "@/src/lib/notifications/preferences";
import {
  getReadyPushManager,
  isPushNotificationsSupported,
} from "@/src/lib/notifications/pushSupport";
import {
  getPermissionStatus,
  requestNotificationPermission,
} from "@/src/lib/notifications/requestPermission";

type SettingsClientProps = {
  user: {
    email?: string;
    fullName?: string;
  };
  storageUsage: {
    usedMb: number;
    limitGb: number;
    percentUsed: number;
    approachingLimit: boolean;
  };
};

function normalizeDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function resolveThemeMode(preference: string): "light" | "dark" {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  const supportsMatchMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  if (!supportsMatchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemePreference(preference: string) {
  const root = document.documentElement;
  const body = document.body;
  const resolved = resolveThemeMode(preference);

  root.classList.toggle("dark", resolved === "dark");
  body.classList.toggle("dark", resolved === "dark");
  root.setAttribute("data-theme", resolved);
  body.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  body.style.colorScheme = resolved;
}

export function SettingsClient({ user, storageUsage }: SettingsClientProps) {
  const {
    canInstall,
    isInstalled,
    isOffline,
    install,
    isManualInstallSupported,
    manualInstallHint,
  } = usePWA();
  const [theme, setTheme] = useState<string>("system");
  const { defaultCurrency, setDefaultCurrency } = useDefaultCurrency();
  const [profileName, setProfileName] = useState<string>(user.fullName ?? "");
  const [savedProfileName, setSavedProfileName] = useState<string>(
    user.fullName ?? "",
  );
  const [savingProfileName, setSavingProfileName] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(
    () => getPermissionStatus() || "default",
  );
  const [appNotifEnabled, setAppNotifEnabledState] = useState<boolean>(() =>
    getAppNotificationsEnabled(),
  );
  const [notifBusy, setNotifBusy] = useState(false);
  const utils = trpc.useUtils();
  const vapidQuery = trpc.notifications.getVapidPublicKey.useQuery(undefined, {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
  const subscribeMutation = trpc.notifications.subscribe.useMutation({
    onSuccess: async () => {
      await utils.notifications.status.invalidate();
    },
  });
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation({
    onSuccess: async () => {
      await utils.notifications.status.invalidate();
    },
  });
  const supabase = createClient();

  const handleProfileNameSave = async () => {
    const normalizedName = normalizeDisplayName(profileName);

    if (normalizedName.length === 0) {
      toast.error("Name cannot be empty.");
      return;
    }

    setSavingProfileName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: normalizedName,
        },
      });

      if (error) {
        throw error;
      }

      setProfileName(normalizedName);
      setSavedProfileName(normalizedName);
      setIsEditingName(false);
      toast.success("Display name updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update display name.";
      toast.error(message);
    } finally {
      setSavingProfileName(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleNotificationToggle = async () => {
    if (notifBusy) return;
    setNotifBusy(true);

    try {
      if (appNotifEnabled) {
        let subscriptionEndpoint: string | undefined;
        let subscription: PushSubscription | null = null;

        if (isPushNotificationsSupported()) {
          try {
            const pushManager = await getReadyPushManager();
            subscription = await pushManager.getSubscription();
            subscriptionEndpoint = subscription?.endpoint;
          } catch {
            subscription = null;
            subscriptionEndpoint = undefined;
          }
        }

        // Disable on server even if browser subscription is missing/inconsistent.
        if (subscriptionEndpoint) {
          await unsubscribeMutation.mutateAsync({
            endpoint: subscriptionEndpoint,
          });
        } else {
          await unsubscribeMutation.mutateAsync({});
        }

        if (subscription) {
          await subscription.unsubscribe();
        }

        setAppNotificationsEnabled(false);
        setAppNotifEnabledState(false);
        toast.success("Notifications turned off.");
        return;
      }

      if (notifPermission === "denied") {
        toast.error("Notifications are blocked in browser settings.");
        return;
      }

      if (!isPushNotificationsSupported()) {
        toast.error("Push notifications are not supported on this browser.");
        return;
      }

      const permission = await requestNotificationPermission();
      setNotifPermission(permission);
      if (permission !== "granted") {
        if (permission === "denied") {
          toast.error("Notifications are blocked in browser settings.");
        }
        return;
      }

      const publicKey = vapidQuery.data?.publicKey;
      if (!publicKey) {
        toast.error("Push notifications are not configured yet.");
        return;
      }

      const pushManager = await getReadyPushManager();
      let subscription = await pushManager.getSubscription();
      if (!subscription) {
        subscription = await pushManager.subscribe({
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

      setAppNotificationsEnabled(true);
      setAppNotifEnabledState(true);
      toast.success("Notifications enabled.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update notifications.";
      toast.error(message);
    } finally {
      setNotifBusy(false);
    }
  };

  useEffect(() => {
    try {
      const rawTheme = localStorage.getItem("creatorops-theme");
      const savedTheme =
        rawTheme === "light" || rawTheme === "dark" || rawTheme === "system"
          ? rawTheme
          : "system";
      setTheme(savedTheme);
      applyThemePreference(savedTheme);
    } catch {
      setTheme("system");
      applyThemePreference("system");
    }
  }, []);

  useEffect(() => {
    setProfileName(user.fullName ?? "");
    setSavedProfileName(user.fullName ?? "");
  }, [user.fullName]);

  const handleThemeChange = (newTheme: string) => {
    const safeTheme =
      newTheme === "light" || newTheme === "dark" || newTheme === "system"
        ? newTheme
        : "system";

    try {
      setTheme(safeTheme);
      localStorage.setItem("creatorops-theme", safeTheme);
      applyThemePreference(safeTheme);
      toast.success(`Theme set to ${safeTheme}`);
    } catch (error) {
      console.error("Failed to update theme preference", error);
      toast.error("Could not change theme on this device/browser.");
    }
  };

  const handleExport = () => {
    window.location.href = "/api/export";
    toast.success("Preparing your data export...");
  };

  const handleClearCache = async () => {
    if (typeof window === "undefined") return;

    const confirmed = window.confirm(
      "Clear offline cache and downloaded assets? Your account data stays safe and your preferences are kept.",
    );
    if (!confirmed) {
      return;
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
      toast.success("Offline cache cleared. Preferences were kept. Reloading...");
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleDefaultCurrencyChange = (currency: "USD" | "INR") => {
    setDefaultCurrency(currency);
    toast.success(`Default currency set to ${currency}`);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Account Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Account
        </h2>
        <div className="rounded-2xl border dash-border dash-bg-card overflow-hidden">
          <div className="flex items-center gap-4 p-4 border-b dash-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-muted-foreground">Personal Account</p>
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
            >
              Free Plan
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 border-b dash-border">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Display Name</p>
                {isEditingName ? (
                  <div className="mt-2 flex items-center gap-2 max-w-sm">
                    <Input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder="Enter your name"
                      className="h-9 text-sm"
                      maxLength={80}
                      autoFocus
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">
                    {profileName || "Not set"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {isEditingName ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => {
                      setIsEditingName(false);
                      setProfileName(savedProfileName);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8 dash-shell-primary-btn"
                    onClick={handleProfileNameSave}
                    loading={savingProfileName}
                    disabled={
                      normalizeDisplayName(profileName) === savedProfileName ||
                      normalizeDisplayName(profileName).length === 0
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium"
                  onClick={() => setIsEditingName(true)}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="p-2">
            <LogoutButton className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" />
          </div>
        </div>
        {!isEditingName && (
          <p className="px-1 text-[10px] text-muted-foreground italic">
            Dashboard greeting uses your first name.
          </p>
        )}
      </section>

      {/* App & PWA Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          App Settings
        </h2>
        <div className="rounded-2xl border dash-border dash-bg-card divide-y dash-border">
          {/* PWA Status */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Native App</p>
                <p className="text-xs text-muted-foreground">
                  {isInstalled
                    ? "Already installed"
                    : canInstall
                      ? "Install for offline use"
                      : isManualInstallSupported
                        ? "Install from browser menu"
                        : "Run in standalone mode"}
                </p>
              </div>
            </div>
            {canInstall && !isInstalled && (
              <Button
                size="sm"
                onClick={install}
                className="dash-shell-primary-btn h-8"
              >
                Install
              </Button>
            )}
            {!canInstall && !isInstalled && isManualInstallSupported && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toast.info(
                    manualInstallHint ??
                      "Use browser menu to install this app.",
                  )
                }
                className="h-8"
              >
                How to Install
              </Button>
            )}
            {isInstalled && (
              <Badge variant="outline" className="text-[10px] uppercase">
                Installed
              </Badge>
            )}
          </div>

          {/* Connectivity */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  isOffline
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                    : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30",
                )}
              >
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Connectivity</p>
                <p className="text-xs text-muted-foreground">
                  {isOffline ? "Currently Offline" : "Online & Synced"}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isOffline ? "bg-red-500" : "bg-emerald-500",
              )}
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  notifPermission === "granted" && appNotifEnabled
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                    : notifPermission === "denied"
                      ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                )}
              >
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {notifPermission === "denied"
                    ? "Blocked in browser settings"
                    : notifPermission === "granted" && appNotifEnabled
                      ? "Enabled for alerts & updates"
                      : notifPermission === "granted"
                        ? "Muted in app (browser permission still granted)"
                        : "Permission not yet requested"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={appNotifEnabled && notifPermission === "granted"}
                aria-label="Toggle notifications"
                onClick={handleNotificationToggle}
                disabled={
                  notifBusy ||
                  subscribeMutation.isPending ||
                  unsubscribeMutation.isPending
                }
                className={cn(
                  "relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200",
                  appNotifEnabled && notifPermission === "granted"
                    ? "bg-emerald-500"
                    : "dash-bg-panel",
                  (notifBusy ||
                    subscribeMutation.isPending ||
                    unsubscribeMutation.isPending) &&
                    "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                    appNotifEnabled && notifPermission === "granted"
                      ? "translate-x-7"
                      : "translate-x-1",
                  )}
                />
              </button>
              {notifPermission === "denied" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.info("How to re-enable", {
                      description:
                        "Tap the icon in your browser address bar (usually a lock or settings icon) to reset notification permissions.",
                    })
                  }
                  className="h-8 text-[10px] uppercase border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  Blocked
                </Button>
              )}
              {notifPermission === "granted" && appNotifEnabled && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase text-emerald-600 border-emerald-200 bg-emerald-50"
                >
                  Active
                </Badge>
              )}
            </div>
          </div>

          {/* Appearance */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Moon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Appearance</p>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 dash-bg-panel rounded-xl">
              {[
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
                { id: "system", icon: Monitor, label: "System" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleThemeChange(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg text-xs font-medium transition-all",
                    theme === item.id
                      ? "dash-bg-card gold-text shadow-sm border dash-border"
                      : "dash-text-muted hover:dash-text",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Default Currency</p>
                <p className="text-xs text-muted-foreground">
                  Used by deal and payment forms across the app.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 dash-bg-panel rounded-xl">
              {(["USD", "INR"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => handleDefaultCurrencyChange(currency)}
                  className={cn(
                    "py-2 px-1 rounded-lg text-xs font-medium transition-all",
                    defaultCurrency === currency
                      ? "dash-bg-card gold-text shadow-sm border dash-border"
                      : "dash-text-muted hover:dash-text",
                  )}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Storage Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Storage
        </h2>
        <div className="rounded-2xl border dash-border dash-bg-card p-4 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-medium">Media Storage</p>
              <p className="text-xs text-muted-foreground">
                {storageUsage.usedMb} MB of {storageUsage.limitGb} GB used
              </p>
            </div>
            <p
              className={cn(
                "text-xs font-bold",
                storageUsage.approachingLimit
                  ? "text-yellow-600"
                  : "text-blue-600",
              )}
            >
              {storageUsage.percentUsed}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full dash-bg-panel">
            <div
              className={cn(
                "h-full transition-all",
                storageUsage.approachingLimit ? "bg-yellow-500" : "bg-blue-600",
              )}
              style={{ width: `${storageUsage.percentUsed}%` }}
            />
          </div>
          {storageUsage.approachingLimit && (
            <div className="flex gap-2 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-900/40">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-xs">
                You're nearly out of space. Consider deleting some old media
                assets.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Data Management Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Data & Privacy
        </h2>
        <div className="rounded-2xl border dash-border dash-bg-card divide-y dash-border">
          <button
            type="button"
            onClick={handleExport}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--shell-panel-bg)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground">
                  Download as CSV & JSON Zip
                </p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={handleClearCache}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--shell-panel-bg)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Clear Cache</p>
                <p className="text-xs text-muted-foreground">
                  Clear offline cache & downloaded assets
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* About Section */}
      <section className="space-y-3">
        <div className="rounded-2xl border dash-border dash-bg-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Security & Privacy</p>
              <p className="text-xs text-muted-foreground">
                CreatorOps OS v1.0.0-beta
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t dash-border">
            <a href="/privacy" className="text-xs dash-link hover:underline">
              Privacy Policy
            </a>
            <a href="/terms" className="text-xs dash-link hover:underline">
              Terms of Service
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
