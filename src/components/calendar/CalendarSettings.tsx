"use client";

import * as Popover from "@radix-ui/react-popover";
import { Settings, X } from "lucide-react";
import { memo } from "react";
import { type View, Views } from "react-big-calendar";
import { cn } from "@/lib/utils";

interface CalendarSettingsProps {
  preferences: {
    defaultView: View;
    weekStartsOn: 0 | 1;
    showWeekends: boolean;
    eventDensity: "compact" | "comfortable" | "spacious";
  };
  setPreference: (key: string, value: string | number | boolean) => void;
}

export const CalendarSettings = memo(function CalendarSettings({
  preferences,
  setPreference,
}: CalendarSettingsProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="p-2 dash-text-muted hover:dash-text hover:dash-bg-card rounded-full transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-72 dash-bg-card rounded-2xl shadow-2xl border dash-border p-5 z-[var(--z-toast)] animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          align="end"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif font-bold text-lg gold-text">
              Preferences
            </h3>
            <Popover.Close className="dash-text-soft hover:dash-text p-1">
              <X className="w-4 h-4" />
            </Popover.Close>
          </div>

          <div className="space-y-6">
            {/* Default View */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-widest dash-text-muted px-1">
                Default View
              </p>
              <select
                value={preferences.defaultView}
                onChange={(e) => setPreference("defaultView", e.target.value)}
                className="w-full rounded-xl border dash-border dash-bg-panel dash-text text-sm py-2 px-3 focus:ring-2 focus:ring-[var(--shell-gold)] outline-none appearance-none cursor-pointer"
              >
                <option value={Views.MONTH}>Month</option>
                <option value={Views.WEEK}>Week</option>
                <option value={Views.DAY}>Day</option>
                <option value={Views.AGENDA}>Agenda</option>
              </select>
            </div>

            {/* Week Starts On */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-widest dash-text-muted px-1">
                Week Starts On
              </p>
              <div className="flex rounded-xl border dash-border overflow-hidden dash-bg-panel p-1">
                <button
                  type="button"
                  onClick={() => setPreference("weekStartsOn", 0)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    preferences.weekStartsOn === 0
                      ? "bg-white dark:bg-white/10 shadow-sm gold-text"
                      : "dash-text-muted hover:dash-text",
                  )}
                >
                  Sun
                </button>
                <button
                  type="button"
                  onClick={() => setPreference("weekStartsOn", 1)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    preferences.weekStartsOn === 1
                      ? "bg-white dark:bg-white/10 shadow-sm gold-text"
                      : "dash-text-muted hover:dash-text",
                  )}
                >
                  Mon
                </button>
              </div>
            </div>

            {/* Show Weekends */}
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase font-bold tracking-widest dash-text-muted">
                Show Weekends
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.showWeekends}
                aria-label="Show weekends"
                onClick={() =>
                  setPreference("showWeekends", !preferences.showWeekends)
                }
                className={cn(
                  "relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none",
                  preferences.showWeekends
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                    preferences.showWeekends
                      ? "translate-x-5.5"
                      : "translate-x-1",
                  )}
                />
              </button>
            </div>

            {/* Event Density */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-widest dash-text-muted px-1">
                Density
              </p>
              <select
                value={preferences.eventDensity}
                onChange={(e) => setPreference("eventDensity", e.target.value)}
                className="w-full rounded-xl border dash-border dash-bg-panel dash-text text-sm py-2 px-3 focus:ring-2 focus:ring-[var(--shell-gold)] outline-none appearance-none cursor-pointer"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
          </div>

          <Popover.Arrow className="fill-border dark:fill-white/10" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
