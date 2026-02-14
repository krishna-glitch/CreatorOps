"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { formatDealDate } from "@/src/components/deals/StatusBadge";
import { DeadlineStateBadge } from "./DeadlineStateBadge";
import { DeliverableForm } from "./DeliverableForm";

type DealDeliverablesSectionProps = {
  dealId: string;
};

export function DealDeliverablesSection({ dealId }: DealDeliverablesSectionProps) {
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
    <section className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
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
        <p className="mt-3 text-sm text-muted-foreground">Loading deliverables...</p>
      ) : deliverablesQuery.error ? (
        <p className="mt-3 text-sm text-red-600">Could not load deliverables.</p>
      ) : (deliverablesQuery.data?.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No deliverables added to this deal yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-muted-foreground dark:border-gray-800">
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
              {deliverablesQuery.data?.map((deliverable) => (
                <tr
                  key={deliverable.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-900"
                >
                  <td className="px-3 py-3 font-medium">
                    {deliverable.platform} / {deliverable.type}
                  </td>
                  <td className="px-3 py-3">{deliverable.quantity}</td>
                  <td className="px-3 py-3">
                    {deliverable.scheduledAt
                      ? formatDealDate(deliverable.scheduledAt, undefined, true)
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
