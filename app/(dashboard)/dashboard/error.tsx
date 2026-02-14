"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-rose-100 bg-rose-50/40">
        <CardHeader>
          <CardTitle className="text-base text-rose-800">
            Dashboard failed to load
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-rose-700">
            Something went wrong while rendering dashboard widgets.
          </p>
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
