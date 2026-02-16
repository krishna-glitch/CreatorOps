"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { inferRouterOutputs } from "@trpc/server";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/api/root";
import { DealCardWithMenu } from "@/src/components/deals/DealCardWithMenu";
import {
  formatDealCurrency,
  formatDealDate,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";
import { GestureTutorial } from "@/src/components/onboarding/GestureTutorial";
import { VoiceCommandButton } from "@/src/components/voice/VoiceCommandButton";
import { usePullToRefresh } from "@/src/hooks/usePullToRefresh";
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

type DealsListResponse = inferRouterOutputs<AppRouter>["deals"]["list"];
type DealItem = DealsListResponse["items"][number];

type DealsListClientProps = {
  initialData: DealsListResponse | null;
  pageSize: number;
  aiExtractionEnabled: boolean;
};

function DealCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border dash-border dash-bg-card p-4">
      <div className="h-10 w-10 shrink-0 rounded-full dash-bg-card" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded dash-bg-card" />
        <div className="h-3 w-1/4 rounded dash-bg-card" />
      </div>
      <div className="h-8 w-20 rounded dash-bg-card" />
    </div>
  );
}

function BrandAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div className="pillowy-card gold-text flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
      {initial}
    </div>
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function findDealByBrand(items: DealItem[], brandName: string | undefined) {
  if (!brandName) {
    return null;
  }

  const normalizedBrand = normalizeText(brandName);
  const exactMatch =
    items.find(
      (item) => normalizeText(item.brand?.name ?? "") === normalizedBrand,
    ) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  return (
    items.find((item) =>
      normalizeText(item.brand?.name ?? "").includes(normalizedBrand),
    ) ?? null
  );
}

function isUnpaidStatus(status: DealItem["status"]) {
  return status !== "PAID";
}

export function DealsListClient({
  initialData,
  pageSize,
  aiExtractionEnabled,
}: DealsListClientProps) {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const [optimisticStatusById, setOptimisticStatusById] = useState<
    Record<string, DealItem["status"]>
  >({});
  const [activeSwipeCardId, setActiveSwipeCardId] = useState<string | null>(
    null,
  );
  const [commandFilter, setCommandFilter] = useState<"ALL" | "UNPAID">("ALL");
  const [isVoiceInteractionActive, setIsVoiceInteractionActive] =
    useState(false);
  const listParentRef = useRef<HTMLDivElement | null>(null);

  const dealsQuery = trpc.deals.list.useInfiniteQuery(
    { limit: pageSize },
    {
      initialData: initialData
        ? {
            pages: [initialData],
            pageParams: [undefined],
          }
        : undefined,
      getNextPageParam: (lastPage) => {
        if (!lastPage.hasMore || !lastPage.nextCursor) {
          return undefined;
        }

        return lastPage.nextCursor;
      },
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

  const { data: brandsData } = trpc.brands.list.useQuery({ limit: 100 });
  const createBrandMutation = trpc.brands.create.useMutation();
  const createDealMutation = trpc.deals.create.useMutation();
  const createDeliverableMutation = trpc.deliverables.create.useMutation();
  const updateDealStatusMutation = trpc.deals.updateStatus.useMutation();
  const createPaymentMutation = trpc.payments.create.useMutation();
  const updateDeliverableMutation = trpc.deliverables.update.useMutation();

  const items = useMemo(() => {
    const pages = dealsQuery.data?.pages ?? [];
    if (pages.length === 0) {
      return [] as DealItem[];
    }

    const flattened = pages.flatMap((page) => page.items);
    const knownIds = new Set<string>();
    const uniqueItems: DealItem[] = [];

    for (const item of flattened) {
      if (knownIds.has(item.id)) {
        continue;
      }
      knownIds.add(item.id);
      uniqueItems.push(item);
    }

    return uniqueItems;
  }, [dealsQuery.data]);

  const brandItems = brandsData?.items ?? [];
  const brandNames = brandItems.map((brand) => brand.name);

  const visibleItems = useMemo(() => {
    if (commandFilter === "UNPAID") {
      return items.filter((item) =>
        isUnpaidStatus(optimisticStatusById[item.id] ?? item.status),
      );
    }

    return items;
  }, [commandFilter, items, optimisticStatusById]);

  const isInitialLoading = dealsQuery.isLoading && items.length === 0;
  const isLoadingMore = dealsQuery.isFetchingNextPage;
  const isAIExtractionEnabled =
    aiAvailabilityQuery.data?.enabled ?? aiExtractionEnabled;
  const hasMore = dealsQuery.hasNextPage;

  const refreshDeals = useCallback(async () => {
    await dealsQuery.refetch();
  }, [dealsQuery]);

  const pullToRefresh = usePullToRefresh({
    scrollRef: listParentRef,
    onRefresh: refreshDeals,
    disabled: dealsQuery.isFetchingNextPage || isVoiceInteractionActive,
  });

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 104,
    overscan: 6,
  });
  const virtualItems = virtualizer.getVirtualItems();

  const createdCountLabel = useMemo(() => {
    if (visibleItems.length === 1) return "1 deal";
    return `${visibleItems.length} deals`;
  }, [visibleItems.length]);

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    void dealsQuery.fetchNextPage();
  };

  useEffect(() => {
    if (!hasMore || isLoadingMore || virtualItems.length === 0) {
      return;
    }

    const lastVirtualRow = virtualItems[virtualItems.length - 1];
    if (lastVirtualRow && lastVirtualRow.index >= visibleItems.length - 4) {
      void dealsQuery.fetchNextPage();
    }
  }, [dealsQuery, hasMore, isLoadingMore, virtualItems, visibleItems.length]);

  const findDealForBrand = useCallback(
    (brandName: string | undefined) => findDealByBrand(items, brandName),
    [items],
  );

  const ensureBrandId = useCallback(
    async (brandName: string) => {
      const normalized = normalizeText(brandName);
      const existing =
        brandItems.find((brand) => normalizeText(brand.name) === normalized) ??
        brandItems.find((brand) =>
          normalizeText(brand.name).includes(normalized),
        );

      if (existing) {
        return existing.id;
      }

      const created = await createBrandMutation.mutateAsync({
        name: brandName.trim(),
      });
      await trpcUtils.brands.list.invalidate();
      return created.id;
    },
    [brandItems, createBrandMutation, trpcUtils.brands.list],
  );

  const executeParsedCommand = useCallback(
    async (command: ParsedCommand) => {
      if (command.intent === "UNKNOWN") {
        toast.error(
          "I didn't understand that. Try again with a brand and action.",
          {
            duration: 3200,
          },
        );
        return;
      }

      if (command.intent === "OPEN_NEW_DEAL_FORM") {
        router.push("/deals/new");
        return;
      }

      if (command.intent === "SHOW_UNPAID_DEALS") {
        setCommandFilter("UNPAID");
        toast.success("Showing unpaid deals only.", { duration: 2000 });
        return;
      }

      if (command.intent === "CREATE_DEAL") {
        if (!command.entities.brand || !command.entities.amount) {
          toast.error(
            "Need brand and amount to create a deal. Example: Nike collab fifteen hundred dollars two reels.",
            { duration: 3200 },
          );
          return;
        }

        const brandId = await ensureBrandId(command.entities.brand);
        const createdDeal = await createDealMutation.mutateAsync({
          brand_id: brandId,
          title: `${command.entities.brand} collab`,
          total_value: command.entities.amount,
          currency: command.entities.currency ?? "USD",
          status: "INBOUND",
          revision_limit: 2,
          exclusivity_rules: [],
        });

        if (command.entities.deliverables.length > 0) {
          await Promise.all(
            command.entities.deliverables.map((deliverable) =>
              createDeliverableMutation.mutateAsync({
                deal_id: createdDeal.id,
                platform: deliverable.platform,
                type: deliverable.type,
                quantity: deliverable.quantity,
                status: "DRAFT",
                scheduled_at: null,
                posted_at: null,
              }),
            ),
          );
        }

        setCommandFilter("ALL");
        await Promise.all([
          trpcUtils.deals.list.invalidate(),
          trpcUtils.analytics.getDashboardStats.invalidate(),
          dealsQuery.refetch(),
        ]);
        toast.success(`Deal created for ${command.entities.brand}.`, {
          duration: 2400,
        });
        return;
      }

      if (command.intent === "MARK_PAID") {
        const deal = findDealForBrand(command.entities.brand);
        if (!deal) {
          toast.error("Could not find a matching deal for that brand.", {
            duration: 2800,
          });
          return;
        }

        await updateDealStatusMutation.mutateAsync({
          id: deal.id,
          status: "PAID",
        });

        setOptimisticStatusById((previous) => ({
          ...previous,
          [deal.id]: "PAID",
        }));
        await Promise.all([
          trpcUtils.deals.list.invalidate(),
          trpcUtils.analytics.getDashboardStats.invalidate(),
        ]);
        toast.success(`${deal.brand?.name ?? "Deal"} marked PAID.`, {
          duration: 2200,
        });
        return;
      }

      if (command.intent === "ADD_PAYMENT") {
        const deal = findDealForBrand(command.entities.brand);
        if (!deal) {
          toast.error("Could not find a matching deal for that payment.", {
            duration: 2800,
          });
          return;
        }
        if (!command.entities.amount || command.entities.amount <= 0) {
          toast.error("Payment amount is missing in the command.", {
            duration: 2800,
          });
          return;
        }

        const nowIso = new Date().toISOString();
        await createPaymentMutation.mutateAsync({
          deal_id: deal.id,
          amount: command.entities.amount,
          currency: command.entities.currency ?? "USD",
          kind: "FINAL",
          status: "PAID",
          expected_date: null,
          paid_at: nowIso,
          payment_method: "OTHER",
        });

        await Promise.all([
          trpcUtils.analytics.getDashboardStats.invalidate(),
          trpcUtils.payments.listByDeal.invalidate({ deal_id: deal.id }),
        ]);
        toast.success(`Payment added to ${deal.brand?.name ?? "deal"}.`, {
          duration: 2200,
        });
        return;
      }

      if (command.intent === "MARK_POSTED") {
        const deal = findDealForBrand(command.entities.brand);
        if (!deal) {
          toast.error("Could not find a matching deal for that deliverable.", {
            duration: 3000,
          });
          return;
        }

        const deliverableList = await trpcUtils.deliverables.listByDeal.fetch({
          deal_id: deal.id,
        });
        const candidate =
          deliverableList.find(
            (deliverable) =>
              deliverable.status !== "POSTED" &&
              (!command.entities.deliverableType ||
                deliverable.type === command.entities.deliverableType),
          ) ?? null;

        if (!candidate) {
          toast.error("No matching unposted deliverable found.", {
            duration: 3000,
          });
          return;
        }

        await updateDeliverableMutation.mutateAsync({
          id: candidate.id,
          status: "POSTED",
          posted_at: new Date().toISOString(),
        });
        await trpcUtils.deliverables.listByDeal.invalidate({
          deal_id: deal.id,
        });
        toast.success("Deliverable marked as posted.", { duration: 2000 });
      }
    },
    [
      createDealMutation,
      createDeliverableMutation,
      createPaymentMutation,
      dealsQuery,
      ensureBrandId,
      findDealForBrand,
      router,
      trpcUtils.analytics.getDashboardStats,
      trpcUtils.deals.list,
      trpcUtils.deliverables.listByDeal,
      trpcUtils.payments.listByDeal,
      updateDealStatusMutation,
      updateDeliverableMutation,
    ],
  );

  const isVoiceActionPending =
    createBrandMutation.isPending ||
    createDealMutation.isPending ||
    createDeliverableMutation.isPending ||
    updateDealStatusMutation.isPending ||
    createPaymentMutation.isPending ||
    updateDeliverableMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <GestureTutorial />
      <VoiceCommandButton
        brandVocabulary={brandNames}
        disabled={isVoiceActionPending}
        onExecuteCommand={executeParsedCommand}
        onInteractionChange={setIsVoiceInteractionActive}
      />

      <div className="pillowy-card rounded-2xl border dash-border dash-bg-card p-6 dash-bg-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight dash-text sm:text-3xl">
              Deals
            </h1>
            <p className="mt-1 text-sm dash-text-muted">
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
              <span className="rounded-md border border-dashed dash-border px-3 py-2 text-xs dash-text-muted">
                AI Create temporarily disabled (quota)
              </span>
            )}
            <Link href="/deals/new" className={buttonVariants()}>
              Create New Deal
            </Link>
            {commandFilter === "UNPAID" ? (
              <button
                type="button"
                className={buttonVariants({ variant: "outline" })}
                onClick={() => setCommandFilter("ALL")}
              >
                Show All Deals
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isInitialLoading ? (
            <>
              <DealCardSkeleton />
              <DealCardSkeleton />
              <DealCardSkeleton />
            </>
          ) : visibleItems.length === 0 ? (
            <p className="rounded-xl border border-dashed dash-border px-4 py-8 text-center text-sm dash-text-muted">
              No deals yet
            </p>
          ) : (
            <div
              ref={listParentRef}
              className="relative max-h-[72vh] overflow-auto pr-1 touch-pan-y [overscroll-behavior-y:contain]"
              onTouchStart={pullToRefresh.handleTouchStart}
              onTouchMove={pullToRefresh.handleTouchMove}
              onTouchEnd={pullToRefresh.handleTouchEnd}
              onTouchCancel={pullToRefresh.handleTouchCancel}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border dash-border dash-bg-panel text-xs"
                  style={{
                    opacity:
                      pullToRefresh.status === "idle" &&
                      pullToRefresh.pullDistance <= 0
                        ? 0
                        : 1,
                    transform: `scale(${0.65 + pullToRefresh.progress * 0.35})`,
                    transition:
                      pullToRefresh.status === "pulling" ||
                      pullToRefresh.status === "ready"
                        ? "opacity 120ms ease-out"
                        : "opacity 180ms ease-out, transform 180ms ease-out",
                  }}
                >
                  {pullToRefresh.status === "success" ? (
                    <Check className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Loader2
                      className={`h-5 w-5 gold-text ${
                        pullToRefresh.isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                  )}
                </div>
              </div>

              <div style={pullToRefresh.containerStyle}>
                <div
                  className="relative w-full"
                  style={{ height: `${virtualizer.getTotalSize()}px` }}
                >
                  {virtualItems.map((virtualRow) => {
                    const deal = visibleItems[virtualRow.index];
                    if (!deal) {
                      return null;
                    }

                    const effectiveStatus =
                      optimisticStatusById[deal.id] ?? deal.status;
                    const normalizedCurrency =
                      deal.currency === "USD" || deal.currency === "INR"
                        ? deal.currency
                        : null;

                    return (
                      <div
                        key={deal.id}
                        className="absolute top-0 left-0 w-full"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="pb-3" ref={virtualizer.measureElement}>
                          <DealCardWithMenu
                            deal={{
                              id: deal.id,
                              status: effectiveStatus,
                              title: deal.title,
                              totalValue: deal.totalValue,
                              currency: normalizedCurrency,
                            }}
                            activeCardId={activeSwipeCardId}
                            setActiveCardId={setActiveSwipeCardId}
                            gesturesDisabled={isVoiceInteractionActive}
                            onOpen={() => router.push(`/deals/${deal.id}`)}
                            onStatusUpdated={(dealId, status) => {
                              setOptimisticStatusById((previous) => ({
                                ...previous,
                                [dealId]:
                                  status === "INBOUND" ||
                                  status === "NEGOTIATING" ||
                                  status === "AGREED" ||
                                  status === "PAID" ||
                                  status === "CANCELLED"
                                    ? status
                                    : "INBOUND",
                              }));
                            }}
                            className="pillowy-card transition-all hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="group relative flex items-center gap-4 p-4">
                              <BrandAvatar name={deal.brand?.name ?? "?"} />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate font-semibold dash-text transition-colors group-hover:gold-text">
                                    {deal.title}
                                  </h3>
                                  <StatusBadge status={effectiveStatus} />
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-sm dash-text-muted">
                                  <span className="font-medium dash-text">
                                    {deal.brand?.name ?? "Unknown brand"}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    Created {formatDealDate(deal.createdAt)}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="font-mono font-medium gold-text">
                                  {formatDealCurrency(deal.totalValue, {
                                    currency: deal.currency,
                                  })}
                                </p>
                              </div>
                            </div>
                          </DealCardWithMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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

        {dealsQuery.error ? (
          <p className="mt-4 text-sm dash-text-danger">
            Could not load deals. Please refresh.
          </p>
        ) : null}

        {dealsQuery.isFetchNextPageError ? (
          <p className="mt-4 text-sm dash-text-danger">
            Could not load more deals. Try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
