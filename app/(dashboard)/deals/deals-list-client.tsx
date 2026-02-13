"use client";

import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  formatDealCurrency,
  formatDealDate,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";
import type { AppRouter } from "@/server/api/root";

type DealsListResponse = inferRouterOutputs<AppRouter>["deals"]["list"];
type DealItem = DealsListResponse["items"][number];

type DealsListClientProps = {
  initialData: DealsListResponse | null;
  pageSize: number;
};

function DealCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-3 h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-4 h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-3 h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export function DealsListClient({ initialData, pageSize }: DealsListClientProps) {
  const [items, setItems] = useState<DealItem[]>(initialData?.items ?? []);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData?.nextCursor ?? null,
  );
  const [nextCursorId, setNextCursorId] = useState<string | null>(
    initialData?.nextCursorId ?? null,
  );
  const [pendingCursor, setPendingCursor] = useState<{
    cursor: string;
    cursorId?: string;
  } | null>(null);

  const initialQuery = trpc.deals.list.useQuery(
    { limit: pageSize },
    {
      initialData: initialData ?? undefined,
      refetchOnWindowFocus: false,
    },
  );

  const loadMoreQuery = trpc.deals.list.useQuery(
    {
      cursor: pendingCursor?.cursor,
      cursorId: pendingCursor?.cursorId,
      limit: pageSize,
    },
    {
      enabled: pendingCursor !== null,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!initialQuery.data) {
      return;
    }

    setItems(initialQuery.data.items);
    setHasMore(initialQuery.data.hasMore);
    setNextCursor(initialQuery.data.nextCursor);
    setNextCursorId(initialQuery.data.nextCursorId ?? null);
  }, [initialQuery.data]);

  useEffect(() => {
    if (!loadMoreQuery.data) {
      return;
    }

    setItems((previous) => {
      const knownIds = new Set(previous.map((deal) => deal.id));
      const incoming = loadMoreQuery.data.items.filter(
        (deal) => !knownIds.has(deal.id),
      );
      return [...previous, ...incoming];
    });
    setHasMore(loadMoreQuery.data.hasMore);
    setNextCursor(loadMoreQuery.data.nextCursor);
    setNextCursorId(loadMoreQuery.data.nextCursorId ?? null);
    setPendingCursor(null);
  }, [loadMoreQuery.data]);

  const isInitialLoading = initialQuery.isLoading && items.length === 0;
  const isLoadingMore = loadMoreQuery.isFetching || pendingCursor !== null;

  const createdCountLabel = useMemo(() => {
    if (items.length === 1) return "1 deal";
    return `${items.length} deals`;
  }, [items.length]);

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setPendingCursor({
      cursor: nextCursor,
      cursorId: nextCursorId ?? undefined,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Deals
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {createdCountLabel} in your pipeline.
            </p>
          </div>
          <Link href="/deals/new" className={buttonVariants()}>
            Create New Deal
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {isInitialLoading ? (
            <>
              <DealCardSkeleton />
              <DealCardSkeleton />
              <DealCardSkeleton />
            </>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700">
              No deals yet
            </p>
          ) : (
            items.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="block rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {deal.brand?.name ?? "Unknown brand"}
                </p>
                <p className="mt-2 text-base font-semibold">{deal.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDealCurrency(deal.totalValue, {
                    currency: deal.currency,
                  })}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={deal.status} />
                  <span className="text-xs text-muted-foreground">
                    Created {formatDealDate(deal.createdAt)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {hasMore ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className={buttonVariants({ variant: "outline" })}
            >
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}

        {initialQuery.error ? (
          <p className="mt-4 text-sm text-red-600">
            Could not load deals. Please refresh.
          </p>
        ) : null}

        {loadMoreQuery.error ? (
          <p className="mt-4 text-sm text-red-600">
            Could not load more deals. Try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
