import { getReadyPushManager } from "./pushSupport";

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Workers not supported or not in browser context");
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    throw error;
  }
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function getPushSubscription() {
  const pushManager = await getReadyPushManager();
  const subscription = await pushManager.getSubscription();
  return subscription;
}
