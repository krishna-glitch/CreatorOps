"use client";

import { toast } from "sonner";

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications not supported");
  }

  const currentPermission = Notification.permission;

  if (currentPermission === "granted") {
    return "granted";
  }

  if (currentPermission === "denied") {
    // We can't trigger the native popup again if they already denied it
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    
    localStorage.setItem("notification-permission-asked", "true");
    localStorage.setItem("notification-permission-granted", permission === "granted" ? "true" : "false");
    
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

export function getStoredPermissionStatus(): string | null {
  if (typeof window === "undefined") return null;
  return Notification.permission;
}
