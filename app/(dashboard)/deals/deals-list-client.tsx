"use client";

import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/api/root";
import {
  formatDealCurrency,
  formatDealDate,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";

type DealsListResponse = inferRouterOutputs<AppRouter>["deals"]["list"];
type DealItem = DealsListResponse["items"][number];

type DealsListClientProps = {
  initialData: DealsListResponse | null;
  pageSize: number;
  aiExtractionEnabled: boolean;
};

function DealCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4">
      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-gray-100" />
        <div className="h-3 w-1/4 rounded bg-gray-100" />
      </div>
      <div className="h-8 w-20 rounded bg-gray-100" />
    </div>
  );
}

function BrandAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const colors = [
    "bg-red-100 text-red-700",
    "bg-orange-100 text-orange-700",
    "bg-amber-100 text-amber-700",
    "bg-green-100 text-green-700",
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-cyan-100 text-cyan-700",
    "bg-blue-100 text-blue-700",
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-purple-100 text-purple-700",
    "bg-fuchsia-100 text-fuchsia-700",
    "bg-pink-100 text-pink-700",
    "bg-rose-100 text-rose-700",
  ];

  // Deterministic color based on name length
  const colorIndex = name ? name.length % colors.length : 7;
  const colorClass = colors[colorIndex];

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${colorClass}`}
    >
      {initial}
    </div>
  );
}

export function DealsListClient({
  initialData,
  pageSize,
  aiExtractionEnabled,
}: DealsListClientProps) {
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

  const aiAvailabilityQuery = trpc.ai.extractionAvailability.useQuery(
    undefined,
    {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
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
  const isAIExtractionEnabled =
    aiAvailabilityQuery.data?.enabled ?? aiExtractionEnabled;

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
          <div className="flex flex-wrap items-center gap-2">
            {isAIExtractionEnabled ? (
              <Link
                href="/deals/ai-create"
                className={buttonVariants({ variant: "outline" })}
              >
                AI Create Deal
              </Link>
            ) : (
              <span className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-muted-foreground dark:border-gray-700">
                AI Create temporarily disabled (quota)
              </span>
            )}
            <Link href="/deals/new" className={buttonVariants()}>
              Create New Deal
            </Link>
          </div>
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
                className="group relative flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <BrandAvatar name={deal.brand?.name ?? "?"} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {deal.title}
                    </h3>
                    <StatusBadge status={deal.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">
                      {deal.brand?.name ?? "Unknown brand"}
                    </span>
                    <span>·</span>
                    <span>Created {formatDealDate(deal.createdAt)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-medium text-gray-900">
                    {formatDealCurrency(deal.totalValue, {
                      currency: deal.currency,
                    })}
                  </p>
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
