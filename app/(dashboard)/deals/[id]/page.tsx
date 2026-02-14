import { TRPCError } from "@trpc/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  formatDealCurrency,
  formatDealDate,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";
import { DealDeliverablesSection } from "@/src/components/deliverables/DealDeliverablesSection";
import { appRouter } from "@/server/api/root";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getPaymentStatusClassName(status: string | null) {
  const normalized = status ?? "UNKNOWN";

  if (normalized === "PAID") {
    return "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }

  if (normalized === "EXPECTED") {
    return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }

  if (normalized === "OVERDUE") {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }

  return "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

function formatPaymentAmount(
  value: string | number | null,
  currency: string | null | undefined,
) {
  const normalizedCurrency = currency === "USD" || currency === "INR" ? currency : null;
  return formatDealCurrency(value, { currency: normalizedCurrency });
}

function formatRevisionHours(totalMinutes: number) {
  const hours = totalMinutes / 60;
  return `${hours.toFixed(1)} hours`;
}

function getRevisionStatusClassName(revisionsUsed: number, revisionLimit: number) {
  if (revisionsUsed > revisionLimit) {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }

  if (revisionsUsed >= revisionLimit) {
    return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }

  return "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const caller = appRouter.createCaller({
    db,
    user,
    headers: new Headers(),
  });

  try {
    const deal = await caller.deals.getById({ id });
    const payments = await caller.payments.listByDeal({ deal_id: id });
    const revisionStats = await caller.feedback.getDealRevisionStats({ deal_id: id });

    const totalExpected = payments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
    const totalPaid = payments.reduce(
      (sum, payment) =>
        payment.status === "PAID" ? sum + (Number(payment.amount) || 0) : sum,
      0,
    );
    const outstanding = Math.max(totalExpected - totalPaid, 0);
    const revisionLimit = deal.revisionLimit;
    const revisionsUsed = deal.revisionsUsed;
    const revisionProgressPercent = Math.min(
      100,
      Math.round((revisionsUsed / Math.max(revisionLimit, 1)) * 100),
    );
    const revisionBarColor =
      revisionsUsed > revisionLimit
        ? "bg-red-500"
        : revisionsUsed >= revisionLimit
          ? "bg-yellow-500"
          : "bg-green-500";
    const revisionAlertMessage =
      revisionsUsed > revisionLimit
        ? "Revision limit exceeded. Negotiate an additional fee for extra revision cycles."
        : revisionsUsed >= revisionLimit
          ? "Revision limit reached. Negotiate an additional fee before additional revisions."
          : null;

    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {deal.brand?.name ?? "Unknown brand"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {deal.title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/deals"
                className={buttonVariants({ variant: "outline" })}
              >
                Back to Deals
              </Link>
              <Link href={`/deals/${deal.id}/edit`} className={buttonVariants({ variant: "default" })}>
                Edit Deal
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h2 className="text-sm font-medium">Deal Overview</h2>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Amount</dt>
                  <dd className="text-sm font-medium">
                    {formatDealCurrency(deal.totalValue, {
                      currency: deal.currency,
                    })}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Currency</dt>
                  <dd className="text-sm font-medium">
                    {deal.currency ?? "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={deal.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Revisions</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getRevisionStatusClassName(revisionsUsed, revisionLimit)}`}
                    >
                      {revisionsUsed} / {revisionLimit} revisions used
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <h2 className="text-sm font-medium">Dates</h2>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="text-sm font-medium">
                    {formatDealDate(deal.createdAt, undefined, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-muted-foreground">Updated</dt>
                  <dd className="text-sm font-medium">
                    {formatDealDate(deal.updatedAt, undefined, true)}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-sm font-medium">Revision Limit</h2>
            <p className="mt-2 text-sm font-medium">
              {revisionsUsed} / {revisionLimit} revisions used
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className={`h-full ${revisionBarColor}`}
                style={{ width: `${revisionProgressPercent}%` }}
              />
            </div>
            {revisionAlertMessage ? (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-sm ${revisionsUsed > revisionLimit ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300"}`}
              >
                {revisionAlertMessage}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              Total revision time:{" "}
              <span className="font-medium text-foreground">
                {formatRevisionHours(revisionStats.totalRevisionTimeMinutes)}
              </span>
            </p>
          </section>

          <DealDeliverablesSection dealId={deal.id} />

          <section className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Payments</h2>
              <button
                type="button"
                disabled
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Add Payment (Coming Soon)
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Total expected
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatPaymentAmount(totalExpected, deal.currency)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Total paid
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatPaymentAmount(totalPaid, deal.currency)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Outstanding
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatPaymentAmount(outstanding, deal.currency)}
                </p>
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No payments added to this deal yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-muted-foreground dark:border-gray-800">
                      <th scope="col" className="px-3 py-2 font-medium">
                        Amount
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Dates
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Payment method
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-900"
                      >
                        <td className="px-3 py-3 font-medium">
                          {formatPaymentAmount(payment.amount, payment.currency)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentStatusClassName(payment.status)}`}
                          >
                            {payment.status ?? "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <p>
                              Expected:{" "}
                              {payment.expectedDate
                                ? formatDealDate(payment.expectedDate, undefined, true)
                                : "N/A"}
                            </p>
                            <p>
                              Paid:{" "}
                              {payment.paidAt
                                ? formatDealDate(payment.paidAt, undefined, true)
                                : "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {payment.paymentMethod ?? "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  } catch (error) {
    if (
      (error instanceof TRPCError && error.code === "NOT_FOUND") ||
      (error instanceof Error && error.message.includes("NOT_FOUND"))
    ) {
      notFound();
    }

    throw error;
  }
}
