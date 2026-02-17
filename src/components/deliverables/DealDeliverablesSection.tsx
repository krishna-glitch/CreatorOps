"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { formatDealDate } from "@/src/components/deals/StatusBadge";
import { DeadlineStateBadge } from "./DeadlineStateBadge";
import { DeliverableForm } from "./DeliverableForm";
import { FeedbackForm } from "./FeedbackForm";
import { ReworkCycleCompleteForm } from "./ReworkCycleCompleteForm";

type DealDeliverablesSectionProps = {
  dealId: string;
};

function getSeverityClassName(severity: number) {
  if (severity <= 3) {
    return "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }

  if (severity <= 7) {
    return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }

  return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

function getFeedbackTypeClassName(type: string) {
  const map: Record<string, string> = {
    CREATIVE_DIRECTION:
      "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    COMPLIANCE:
      "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    BRAND_VOICE:
      "border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    EDITING:
      "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    COPY: "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    TIMING:
      "border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    TECHNICAL:
      "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    OTHER:
      "border-transparent dash-bg-card text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  };

  return map[type] ?? map.OTHER;
}

function FeedbackForDeliverable({
  dealId,
  deliverableId,
  onCreated,
}: {
  dealId: string;
  deliverableId: string;
  onCreated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  const feedbackQuery = trpc.feedback.listByDeliverable.useQuery(
    { deliverable_id: deliverableId },
    { refetchOnWindowFocus: false },
  );

  const feedbackItems = feedbackQuery.data?.items ?? [];
  const reworkCycleCount = feedbackQuery.data?.reworkCycleCount ?? 0;
  const cycles = feedbackQuery.data?.cycles ?? [];
  const latestOpenCycle = cycles.find((cycle) => cycle.completedAt === null);

  return (
    <div className="space-y-3 rounded-lg dash-bg-card p-3 dark:bg-gray-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Feedback & Rework</p>
          <Badge variant="outline">Cycles: {reworkCycleCount}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {latestOpenCycle ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsCompleteOpen(true)}
            >
              Complete Cycle #{latestOpenCycle.cycleNumber}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
            Add Feedback
          </Button>
        </div>
      </div>

      <FeedbackForm
        dealId={dealId}
        deliverableId={deliverableId}
        open={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);
          if (!nextOpen) {
            void feedbackQuery.refetch();
          }
        }}
        onCreated={() => {
          void feedbackQuery.refetch();
          onCreated();
        }}
      />
      {latestOpenCycle ? (
        <ReworkCycleCompleteForm
          cycleId={latestOpenCycle.id}
          cycleNumber={latestOpenCycle.cycleNumber}
          open={isCompleteOpen}
          onOpenChange={(nextOpen) => {
            setIsCompleteOpen(nextOpen);
            if (!nextOpen) {
              void feedbackQuery.refetch();
            }
          }}
          onCompleted={() => {
            void feedbackQuery.refetch();
            onCreated();
          }}
        />
      ) : null}

      {feedbackQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading feedback...</p>
      ) : feedbackQuery.error ? (
        <p className="text-xs text-red-600">Could not load feedback.</p>
      ) : feedbackItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">No feedback logged yet.</p>
      ) : (
        <div className="space-y-2">
          {feedbackItems.map((feedback) => (
            <div
              key={feedback.id}
              className="rounded-md border dash-border dash-bg-card p-3 dash-border dash-bg-panel"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={getFeedbackTypeClassName(feedback.feedbackType)}
                >
                  {feedback.feedbackType.replaceAll("_", " ")}
                </Badge>
                <Badge className={getSeverityClassName(feedback.severity)}>
                  Severity {feedback.severity}
                </Badge>
                <Badge variant="outline">{feedback.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDealDate(feedback.receivedAt, { includeTime: true })}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm">
                {feedback.messageRaw}
              </p>
              {feedback.summary ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Summary: {feedback.summary}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {cycles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Rework Cycles
          </p>
          {cycles.map((cycle) => (
            <div
              key={cycle.id}
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <Badge variant="outline">#{cycle.cycleNumber}</Badge>
              <span>
                {cycle.completedAt ? "Completed" : "Open"} • Requested{" "}
                {formatDealDate(cycle.requestedAt, { includeTime: true })}
              </span>
              {cycle.timeSpentMinutes !== null ? (
                <span>• Time {cycle.timeSpentMinutes} min</span>
              ) : null}
              {cycle.exceedsContractLimit ? (
                <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  Over Contract
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DealDeliverablesSection({
  dealId,
}: DealDeliverablesSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deliverablesQuery = trpc.deliverables.listByDeal.useQuery(
    { deal_id: dealId },
    {
      refetchOnWindowFocus: false,
    },
  );

  const handleDialogChange = (nextOpen: boolean) => {
    setIsCreateOpen(nextOpen);
    if (!nextOpen) {
      void deliverablesQuery.refetch();
    }
  };

  return (
    <section className="mt-6 rounded-xl border dash-border p-4 dash-border">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Deliverables</h2>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          Add Deliverable
        </button>
      </div>

      <DeliverableForm
        dealId={dealId}
        open={isCreateOpen}
        onOpenChange={handleDialogChange}
        onCreated={() => {
          void deliverablesQuery.refetch();
        }}
      />

      {deliverablesQuery.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Loading deliverables...
        </p>
      ) : deliverablesQuery.error ? (
        <p className="mt-3 text-sm text-red-600">
          Could not load deliverables.
        </p>
      ) : (deliverablesQuery.data?.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No deliverables added to this deal yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b dash-border text-muted-foreground dash-border">
                <th scope="col" className="px-3 py-2 font-medium">
                  Platform + Type
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Quantity
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Scheduled date
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Deadline
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {deliverablesQuery.data?.map((deliverable) => {
                return [
                  <tr
                    key={`${deliverable.id}-row`}
                    className="border-b dash-border dark:border-gray-900"
                  >
                    <td className="px-3 py-3 font-medium">
                      {deliverable.platform} / {deliverable.type}
                    </td>
                    <td className="px-3 py-3">{deliverable.quantity}</td>
                    <td className="px-3 py-3">
                      {deliverable.scheduledAt
                        ? formatDealDate(deliverable.scheduledAt, {
                            includeTime: true,
                          })
                        : "Not scheduled"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <DeadlineStateBadge
                          state={deliverable.deadline_state}
                          reason={deliverable.deadline_state_reason}
                        />
                        <p className="text-xs text-muted-foreground">
                          {deliverable.deadline_state_reason}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{deliverable.status}</Badge>
                    </td>
                  </tr>,
                  <tr
                    key={`${deliverable.id}-feedback`}
                    className="border-b dash-border last:border-0 dark:border-gray-900"
                  >
                    <td className="px-3 pb-4" colSpan={5}>
                      <FeedbackForDeliverable
                        dealId={dealId}
                        deliverableId={deliverable.id}
                        onCreated={() => {
                          void deliverablesQuery.refetch();
                        }}
                      />
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
