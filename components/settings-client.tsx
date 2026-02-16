"use client";

import { 
  User, 
  Smartphone, 
  Moon, 
  Sun, 
  Monitor, 
  Download, 
  Trash2, 
  Cloud, 
  ShieldCheck, 
  Info,
  LogOut,
  ExternalLink,
  Coins
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/src/hooks/usePWA";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";

type SettingsClientProps = {
  user: {
    email?: string;
  };
  storageUsage: {
    usedMb: number;
    limitGb: number;
    percentUsed: number;
    approachingLimit: boolean;
  };
};

export function SettingsClient({ user, storageUsage }: SettingsClientProps) {
  const { canInstall, isInstalled, isOffline, install } = usePWA();
  const [theme, setTheme] = useState<string>("system");
  const { defaultCurrency, setDefaultCurrency } = useDefaultCurrency();

  useEffect(() => {
    const savedTheme = localStorage.getItem("creatorops-theme") || "system";
    setTheme(savedTheme);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("creatorops-theme", newTheme);
    
    const root = document.documentElement;
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      root.classList.toggle("dark", newTheme === "dark");
      root.setAttribute("data-theme", newTheme);
    }
    toast.success(`Theme set to ${newTheme}`);
  };

  const handleExport = () => {
    window.location.href = "/api/export";
    toast.success("Preparing your data export...");
  };

  const handleClearCache = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
      toast.success("Cache cleared. Reloading...");
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Account</h2>
        <div className="rounded-2xl border dash-border bg-white dark:bg-gray-950 overflow-hidden">
          <div className="flex items-center gap-4 p-4 border-b dash-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-muted-foreground">Personal Account</p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">Free Plan</Badge>
          </div>
          <div className="p-2">
             <LogoutButton className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" />
          </div>
        </div>
      </section>

      {/* App & PWA Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">App Settings</h2>
        <div className="rounded-2xl border dash-border bg-white dark:bg-gray-950 divide-y dash-border">
          {/* PWA Status */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Native App</p>
                <p className="text-xs text-muted-foreground">
                  {isInstalled ? "Already installed" : canInstall ? "Install for offline use" : "Run in standalone mode"}
                </p>
              </div>
            </div>
            {canInstall && !isInstalled && (
              <Button size="sm" onClick={install} className="dash-shell-primary-btn h-8">
                Install
              </Button>
            )}
            {isInstalled && (
              <Badge variant="outline" className="text-[10px] uppercase">Installed</Badge>
            )}
          </div>

          {/* Connectivity */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isOffline ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
              )}>
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Connectivity</p>
                <p className="text-xs text-muted-foreground">{isOffline ? "Currently Offline" : "Online & Synced"}</p>
              </div>
            </div>
            <div className={cn("h-2 w-2 rounded-full", isOffline ? "bg-red-500" : "bg-emerald-500")} />
          </div>

          {/* Appearance */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Moon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Appearance</p>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
              {[
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
                { id: "system", icon: Monitor, label: "System" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleThemeChange(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg text-xs font-medium transition-all",
                    theme === item.id 
                      ? "bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400" 
                      : "text-muted-foreground hover:text-foreground"
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
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
              {(["USD", "INR"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => handleDefaultCurrencyChange(currency)}
                  className={cn(
                    "py-2 px-1 rounded-lg text-xs font-medium transition-all",
                    defaultCurrency === currency
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-gray-800 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground",
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Storage</h2>
        <div className="rounded-2xl border dash-border bg-white dark:bg-gray-950 p-4 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-medium">Media Storage</p>
              <p className="text-xs text-muted-foreground">{storageUsage.usedMb} MB of {storageUsage.limitGb} GB used</p>
            </div>
            <p className={cn(
              "text-xs font-bold",
              storageUsage.approachingLimit ? "text-yellow-600" : "text-blue-600"
            )}>
              {storageUsage.percentUsed}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn(
                "h-full transition-all",
                storageUsage.approachingLimit ? "bg-yellow-500" : "bg-blue-600"
              )}
              style={{ width: `${storageUsage.percentUsed}%` }}
            />
          </div>
          {storageUsage.approachingLimit && (
            <div className="flex gap-2 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-900/40">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-xs">You're nearly out of space. Consider deleting some old media assets.</p>
            </div>
          )}
        </div>
      </section>

      {/* Data Management Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Data & Privacy</h2>
        <div className="rounded-2xl border dash-border bg-white dark:bg-gray-950 divide-y dash-border">
          <button 
            onClick={handleExport}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground">Download as CSV & JSON Zip</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>

          <button 
            onClick={handleClearCache}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Clear Cache</p>
                <p className="text-xs text-muted-foreground">Reset local storage & assets</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* About Section */}
      <section className="space-y-3">
        <div className="rounded-2xl border dash-border bg-white dark:bg-gray-950 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Security & Privacy</p>
              <p className="text-xs text-muted-foreground">CreatorOps OS v1.0.0-beta</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t dash-border">
            <a href="#" className="text-xs text-blue-600 hover:underline">Privacy Policy</a>
            <a href="#" className="text-xs text-blue-600 hover:underline">Terms of Service</a>
          </div>
        </div>
      </section>
    </div>
  );
}
