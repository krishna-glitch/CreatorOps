"use client";

export const APP_NOTIFICATIONS_ENABLED_KEY = "creatorops.notifications.enabled.v1";

export function getAppNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(APP_NOTIFICATIONS_ENABLED_KEY);
  if (raw === null) return true;
  return raw === "true";
}

export function setAppNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
}

