"use client";

import { AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

function feedbackTypeTone(feedbackType: string) {
  if (feedbackType === "COPY") {
    return "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300";
  }
  if (feedbackType === "COMPLIANCE") {
    return "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
  }
  if (feedbackType === "CREATIVE_DIRECTION") {
    return "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  }
  return "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

export default function AnalyticsPage() {
  const feedbackInsightsQuery = trpc.analytics.getFeedbackInsights.useQuery(undefined, {
    staleTime: 30_000,
  });

  const data = feedbackInsightsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-gray-500">
          Performance and feedback patterns across your deals.
        </p>
      </div>

      <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Feedback Insights</CardTitle>
          <BarChart3 className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackInsightsQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading feedback insights...</p>
          ) : feedbackInsightsQuery.isError ? (
            <p className="text-sm text-rose-600">
              Could not load feedback insights.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Total feedback
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {data?.totalFeedbackItems ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Most common type
                  </p>
                  {data?.topFeedbackType ? (
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={feedbackTypeTone(data.topFeedbackType.feedbackType)}>
                        {data.topFeedbackType.feedbackType.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {data.topFeedbackType.count}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">No data</p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Demanding clients
                  </p>
                  <p className="mt-1 text-xl font-semibold text-rose-700 dark:text-rose-300">
                    {data?.demandingClients.length ?? 0}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Patterns</p>
                {(data?.patternInsights.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500">
                    No strong feedback pattern detected yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data?.patternInsights.map((insight) => (
                      <li
                        key={insight}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-800 dark:bg-gray-900/40"
                      >
                        {insight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Brands Giving Most Feedback</p>
                {(data?.brandFeedbackStats.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500">No feedback activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data?.brandFeedbackStats.map((brand) => {
                      const isDemanding = brand.highSeverityCount > 3;
                      return (
                        <div
                          key={brand.brandId}
                          className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{brand.brandName}</p>
                            {isDemanding ? (
                              <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                Demanding Client
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {brand.feedbackCount} feedback items • Avg severity{" "}
                            {brand.avgSeverity.toFixed(1)} • High severity ({">"}7):{" "}
                            {brand.highSeverityCount}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
