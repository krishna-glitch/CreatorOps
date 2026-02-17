"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { usePWA } from "@/src/hooks/usePWA";
import { registerServiceWorker } from "@/src/lib/notifications/registerSW";

function promptUpdate(waitingWorker: ServiceWorker) {
  toast("Update available", {
    description: "A newer version is ready.",
    duration: 10000,
    action: {
      label: "Update",
      onClick: () => {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      },
    },
  });
}

export function PWAClient() {
  const { isOffline } = usePWA();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let mounted = true;

    const handleControllerChange = () => {
      if (!mounted) return;
      window.location.reload();
    };

    registerServiceWorker()
      .then((registration) => {
        if (registration.waiting) {
          promptUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller &&
              registration.waiting
            ) {
              promptUpdate(registration.waiting);
            }
          });
        });
      })
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      toast.error("You are currently offline", {
        description: "Some features may be limited.",
        duration: 5000,
      });
    }
  }, [isOffline]);

  return null;
}
