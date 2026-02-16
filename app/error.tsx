"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-gray-600 max-w-md">
        A critical error occurred. We've been notified and are looking into it.
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          Go Home
        </Button>
      </div>
    </div>
  );
}
