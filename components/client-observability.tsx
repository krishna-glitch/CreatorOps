"use client";

import { useEffect } from "react";

type ClientErrorPayload = {
  type: "window_error" | "unhandled_rejection";
  message: string;
  stack?: string;
  pathname: string;
  userAgent: string;
};

function sendClientError(payload: ClientErrorPayload) {
  try {
    const body = JSON.stringify(payload);
    const url = "/api/observability/client-error";
    const blob = new Blob([body], { type: "application/json" });

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon(url, blob);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Swallow observability failures to avoid user impact.
  }
}

export function ClientObservability() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      sendClientError({
        type: "window_error",
        message: event.message || "Unknown window error",
        stack:
          event.error instanceof Error
            ? event.error.stack
            : typeof event.error === "string"
              ? event.error
              : undefined,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = "Unhandled promise rejection";
      let stack: string | undefined;

      if (event.reason instanceof Error) {
        message = event.reason.message;
        stack = event.reason.stack;
      } else if (typeof event.reason === "string") {
        message = event.reason;
      }

      sendClientError({
        type: "unhandled_rejection",
        message,
        stack,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
