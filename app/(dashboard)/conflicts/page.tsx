"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

type ConflictFilter = "ACTIVE" | "RESOLVED";

function getConflictsLoadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("UNAUTHORIZED")) {
      return "Your session expired. Please sign in again.";
    }

    if (error.message.includes("Database error")) {
      return "Database error while loading conflicts.";
    }
  }

  return "Failed to load conflicts.";
}

function getSeverityClassName(severity: "WARN" | "BLOCK") {
  if (severity === "BLOCK") {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }

  return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
}

function formatOverlapDetails(overlap: Record<string, unknown>) {
  return JSON.stringify(overlap, null, 2);
}

export default function ConflictsPage() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const [filter, setFilter] = useState<ConflictFilter>("ACTIVE");

  const conflictsQuery = trpc.conflicts.list.useQuery(
    { status: filter },
    {
      refetchOnWindowFocus: false,
    },
  );

  const markResolvedMutation = trpc.conflicts.markResolved.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.conflicts.list.invalidate(),
        trpcUtils.conflicts.summary.invalidate(),
      ]);
      toast.success("Conflict marked as resolved.", { duration: 2500 });
    },
    onError: (error) => {
      toast.error(error.message || "Could not mark conflict resolved.", {
        duration: 3000,
      });
    },
  });

  const items = conflictsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card p-6 shadow-sm dash-border dash-bg-panel sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Risk Management
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Conflicts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review exclusivity and operational conflicts across deals.
            </p>
          </div>
          <Badge variant="outline">{items.length} shown</Badge>
        </div>

        <div className="mt-6 inline-flex rounded-lg border dash-border p-1 dash-border">
          <button
            type="button"
            onClick={() => setFilter("ACTIVE")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === "ACTIVE" ? "bg-gray-900 text-white dash-bg-card dark:text-gray-900" : "text-muted-foreground"}`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilter("RESOLVED")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === "RESOLVED" ? "bg-gray-900 text-white dash-bg-card dark:text-gray-900" : "text-muted-foreground"}`}
          >
            Resolved
          </button>
        </div>

        {conflictsQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading conflicts...</p>
        ) : conflictsQuery.error ? (
          <p className="mt-6 text-sm text-red-600">
            {getConflictsLoadErrorMessage(conflictsQuery.error)}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No {filter.toLowerCase()} conflicts found.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {items.map((conflict) => {
              const targetDealId = conflict.target_deal_id ?? conflict.conflicting_rule_deal_id;

              return (
                <article
                  key={conflict.id}
                  className="cursor-pointer rounded-xl border dash-border p-4 transition-colors dash-bg-card dash-border dark:hover:bg-gray-900/40"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open conflict ${conflict.id}`}
                  onClick={() => {
                    if (targetDealId) {
                      router.push(`/deals/${targetDealId}`);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!targetDealId) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/deals/${targetDealId}`);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getSeverityClassName(conflict.severity)}>
                          {conflict.severity}
                        </Badge>
                        <Badge variant="outline">{conflict.type}</Badge>
                        {conflict.auto_resolved ? (
                          <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            RESOLVED
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {conflict.target_brand_name ?? conflict.conflicting_rule_brand_name ?? "Unknown Brand"}{" "}
                        ·{" "}
                        {conflict.target_deal_title ??
                          conflict.conflicting_rule_deal_title ??
                          "Unknown Deal"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Conflict ID: {conflict.id}
                        {conflict.target_deliverable_id
                          ? ` · Deliverable ${conflict.target_deliverable_id}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!conflict.auto_resolved ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            markResolvedMutation.mutate({ id: conflict.id });
                          }}
                          loading={markResolvedMutation.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Mark Resolved
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border dash-border dash-bg-card p-3 dash-border dark:bg-gray-900/30">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Overlap Details
                      </p>
                    </div>
                    <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
                      {formatOverlapDetails(conflict.overlap)}
                    </pre>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Suggested Resolutions
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {conflict.suggested_resolutions.map((resolution) => (
                        <li key={resolution}>{resolution}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
