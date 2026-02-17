"use client";

export function isPushNotificationsSupported() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator && typeof window.PushManager === "function"
  );
}

export async function getReadyPushManager() {
  if (!isPushNotificationsSupported()) {
    throw new Error("Push notifications are not supported on this browser.");
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) {
    throw new Error("Push manager is unavailable on this browser.");
  }

  return registration.pushManager;
}
