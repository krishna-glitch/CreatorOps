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
import { appRouter } from "@/server/api/root";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
              <button
                type="button"
                disabled
                className={buttonVariants({ variant: "default" })}
              >
                Edit (Coming Soon)
              </button>
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
