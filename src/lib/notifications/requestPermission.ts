"use client";

function getBrowserNotificationApi() {
  if (typeof window === "undefined") {
    return null;
  }
  return typeof window.Notification === "function" ? window.Notification : null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const notificationApi = getBrowserNotificationApi();
  if (!notificationApi) {
    throw new Error("Notifications not supported");
  }

  const currentPermission = notificationApi.permission;

  if (currentPermission === "granted") {
    localStorage.setItem("notification-permission-asked", "true");
    return "granted";
  }

  if (currentPermission === "denied") {
    // We can't trigger the native popup again if they already denied it
    localStorage.setItem("notification-permission-asked", "true");
    return "denied";
  }

  try {
    const permission = await notificationApi.requestPermission();
    
    localStorage.setItem("notification-permission-asked", "true");
    
    return permission;
  } catch (error) {
    console.error("Failed to request permission:", error);
    throw error;
  }
}

export function hasAskedForPermission(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("notification-permission-asked") === "true";
}

export function getPermissionStatus(): string | null {
  const notificationApi = getBrowserNotificationApi();
  if (!notificationApi) {
    return null;
  }
  return notificationApi.permission;
}
