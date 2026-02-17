"use client";

import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Loader2,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { DealCardWithMenu } from "@/src/components/deals/DealCardWithMenu";
import {
  formatDealCurrency,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";
import { GestureTutorial } from "@/src/components/onboarding/GestureTutorial";
import { VoiceCommandButton } from "@/src/components/voice/VoiceCommandButton";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";
import { usePullToRefresh } from "@/src/hooks/usePullToRefresh";
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

type DealsListResponse = inferRouterOutputs<AppRouter>["deals"]["list"];
type DealItem = DealsListResponse["items"][number];

type DealsListClientProps = {
  initialData: DealsListResponse | null;
  pageSize: number;
  aiExtractionEnabled: boolean;
};

type TimeLane = "ATTENTION" | "NOW" | "NEXT" | "LATER";

type DealTimingSummary = {
  lane: TimeLane;
  label: string;
  exact: string;
  sortAt: number;
  progressPercent: number;
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

function formatRelativeFromNow(target: Date, now: Date) {
  const deltaMs = target.getTime() - now.getTime();
  const absMs = Math.abs(deltaMs);
  const minutes = Math.max(1, Math.floor(absMs / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const unitValue = days > 0 ? days : hours > 0 ? hours : minutes;
  const unit = days > 0 ? "d" : hours > 0 ? "h" : "m";
  const suffix = `${unitValue}${unit}`;

  if (deltaMs >= 0) {
    return `in ${suffix}`;
  }

  return `${suffix} ago`;
}

function formatExactDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getDealTimingSummary(deal: DealItem, now: Date): DealTimingSummary {
  const activeDeliverables = (deal.deliverables ?? []).filter(
    (deliverable) => deliverable.status !== "POSTED" && !deliverable.postedAt,
  );

  const scheduleDates = activeDeliverables
    .map((deliverable) => {
      if (!deliverable.scheduledAt) {
        return null;
      }
      const parsed = new Date(deliverable.scheduledAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const overdue = scheduleDates.filter(
    (value) => value.getTime() <= now.getTime(),
  );
  const upcoming = scheduleDates.filter(
    (value) => value.getTime() > now.getTime(),
  );

  if (overdue.length > 0) {
    const nearestOverdue = overdue[overdue.length - 1];
    const overdueDuration = formatRelativeFromNow(nearestOverdue, now).replace(
      " ago",
      "",
    );

    return {
      lane: "ATTENTION",
      label: `Overdue by ${overdueDuration}`,
      exact: formatExactDate(nearestOverdue),
      sortAt: nearestOverdue.getTime(),
      progressPercent: 100,
    };
  }

  if (upcoming.length > 0) {
    const nextDate = upcoming[0];
    const diffMs = nextDate.getTime() - now.getTime();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    if (diffMs <= hourMs) {
      const isNow = diffMs <= 15 * 60 * 1000;
      return {
        lane: "NOW",
        label: isNow
          ? "Running now"
          : `Starts ${formatRelativeFromNow(nextDate, now)}`,
        exact: formatExactDate(nextDate),
        sortAt: nextDate.getTime(),
        progressPercent: 85,
      };
    }

    if (diffMs <= dayMs) {
      const urgency = Math.max(35, Math.round(80 - (diffMs / dayMs) * 45));
      return {
        lane: "NEXT",
        label: `Starts ${formatRelativeFromNow(nextDate, now)}`,
        exact: formatExactDate(nextDate),
        sortAt: nextDate.getTime(),
        progressPercent: urgency,
      };
    }

    return {
      lane: "LATER",
      label: `Starts ${formatRelativeFromNow(nextDate, now)}`,
      exact: formatExactDate(nextDate),
      sortAt: nextDate.getTime(),
      progressPercent: 25,
    };
  }

  if (
    deal.status === "PAID" ||
    deal.status === "CANCELLED" ||
    deal.status === "REJECTED"
  ) {
    const completedAt = new Date(deal.updatedAt);
    return {
      lane: "LATER",
      label:
        deal.status === "PAID"
          ? "Completed"
          : deal.status === "REJECTED"
            ? "Rejected"
            : "Cancelled",
      exact: Number.isNaN(completedAt.getTime())
        ? "No schedule"
        : formatExactDate(completedAt),
      sortAt: completedAt.getTime() || 0,
      progressPercent: 100,
    };
  }

  return {
    lane: "LATER",
    label: "No schedule set",
    exact: "Add a deliverable schedule",
    sortAt: new Date(deal.createdAt).getTime(),
    progressPercent: 18,
  };
}

function lanePillClasses(lane: TimeLane) {
  if (lane === "ATTENTION") {
    return "border-rose-300 bg-rose-100 text-rose-700";
  }
  if (lane === "NOW") {
    return "border-emerald-300 bg-emerald-100 text-emerald-700";
  }
  if (lane === "NEXT") {
    return "border-blue-300 bg-blue-100 text-blue-700";
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function laneLabel(lane: TimeLane) {
  if (lane === "ATTENTION") {
    return "Overdue";
  }
  if (lane === "NOW") {
    return "Running";
  }
  if (lane === "NEXT") {
    return "Upcoming";
  }
  return "Later";
}

function laneIcon(lane: TimeLane) {
  if (lane === "ATTENTION") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  if (lane === "NOW") {
    return <PlayCircle className="h-4 w-4" />;
  }
  return <CalendarClock className="h-4 w-4" />;
}

export function DealsListClient({
  initialData,
  pageSize,
  aiExtractionEnabled,
}: DealsListClientProps) {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const { defaultCurrency } = useDefaultCurrency();
  const [optimisticStatusById, setOptimisticStatusById] = useState<
    Record<string, DealItem["status"]>
  >({});
  const [activeSwipeCardId, setActiveSwipeCardId] = useState<string | null>(
    null,
  );
  const [commandFilter, setCommandFilter] = useState<"ALL" | "UNPAID">("ALL");
  const [focusMode, setFocusMode] = useState<
    "ALL" | "NOW" | "NEXT" | "ACTION_NEEDED" | "REJECTED"
  >("ALL");
  const [isVoiceInteractionActive, setIsVoiceInteractionActive] =
    useState(false);
  const [now, setNow] = useState(() => new Date());
  const listParentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

        return {
          cursor: lastPage.nextCursor,
          cursorId: lastPage.nextCursorId ?? undefined,
          limit: pageSize,
        };
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

  const filteredItems = useMemo(() => {
    if (commandFilter === "UNPAID") {
      return items.filter((item) =>
        isUnpaidStatus(optimisticStatusById[item.id] ?? item.status),
      );
    }

    return items;
  }, [commandFilter, items, optimisticStatusById]);

  const timedItems = useMemo(() => {
    return filteredItems.map((item) => {
      const effectiveStatus = optimisticStatusById[item.id] ?? item.status;
      const timing = getDealTimingSummary(item, now);
      return {
        item,
        effectiveStatus,
        timing,
      };
    });
  }, [filteredItems, now, optimisticStatusById]);

  const visibleTimedItems = useMemo(() => {
    if (focusMode === "ACTION_NEEDED") {
      return timedItems.filter(
        ({ timing }) => timing.lane === "ATTENTION" || timing.lane === "NOW",
      );
    }
    if (focusMode === "NOW") {
      return timedItems.filter(({ timing }) => timing.lane === "NOW");
    }
    if (focusMode === "NEXT") {
      return timedItems.filter(({ timing }) => timing.lane === "NEXT");
    }
    if (focusMode === "REJECTED") {
      return timedItems.filter(
        ({ effectiveStatus }) =>
          effectiveStatus === "REJECTED" || effectiveStatus === "CANCELLED",
      );
    }
    return timedItems;
  }, [focusMode, timedItems]);

  const groupedItems = useMemo(() => {
    const attention: typeof visibleTimedItems = [];
    const nowItems: typeof visibleTimedItems = [];
    const next: typeof visibleTimedItems = [];
    const later: typeof visibleTimedItems = [];

    for (const entry of visibleTimedItems) {
      if (entry.timing.lane === "ATTENTION") {
        attention.push(entry);
        continue;
      }
      if (entry.timing.lane === "NOW") {
        nowItems.push(entry);
        continue;
      }
      if (entry.timing.lane === "NEXT") {
        next.push(entry);
        continue;
      }
      later.push(entry);
    }

    const sortByTime = (
      a: (typeof visibleTimedItems)[number],
      b: (typeof visibleTimedItems)[number],
    ) => a.timing.sortAt - b.timing.sortAt;

    attention.sort(sortByTime);
    nowItems.sort(sortByTime);
    next.sort(sortByTime);
    later.sort(sortByTime);

    return {
      attention,
      nowItems,
      next,
      later,
    };
  }, [visibleTimedItems]);

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

  const createdCountLabel = useMemo(() => {
    if (visibleTimedItems.length === 1) return "1 deal";
    return `${visibleTimedItems.length} deals`;
  }, [visibleTimedItems.length]);

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    void dealsQuery.fetchNextPage();
  };

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
        setFocusMode("ACTION_NEEDED");
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
          currency: command.entities.currency ?? defaultCurrency,
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
          currency: command.entities.currency ?? defaultCurrency,
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
      defaultCurrency,
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

  const upcomingTopItem = groupedItems.next[0] ?? groupedItems.later[0] ?? null;
  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const sections = [
    {
      key: "attention",
      title: "Needs attention",
      items: groupedItems.attention,
      emptyLabel: "No overdue tasks.",
      tone: "attention",
    },
    {
      key: "now",
      title: "Now",
      items: groupedItems.nowItems,
      emptyLabel: "Nothing running right now.",
      tone: "now",
    },
    {
      key: "next",
      title: "Next (0-24h)",
      items: groupedItems.next,
      emptyLabel: "No upcoming tasks in the next 24 hours.",
      tone: "next",
    },
    {
      key: "later",
      title: "Later",
      items: groupedItems.later,
      emptyLabel: "No later tasks.",
      tone: "later",
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
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
            <p className="mt-1 text-xs dash-text-muted">
              All times in {timezoneLabel}
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
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setFocusMode("NOW")}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              focusMode === "NOW"
                ? "border-blue-300 bg-blue-50"
                : "dash-border dash-bg-card",
            )}
          >
            <p className="text-xs uppercase tracking-wide dash-text-muted">
              Now
            </p>
            <p className="mt-1 text-lg font-semibold dash-text">
              {groupedItems.nowItems.length} running
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFocusMode("NEXT")}
            className="rounded-xl border dash-border dash-bg-card p-3 text-left transition hover:border-blue-200"
          >
            <p className="text-xs uppercase tracking-wide dash-text-muted">
              Next up
            </p>
            <p className="mt-1 text-sm font-medium dash-text">
              {upcomingTopItem
                ? `${upcomingTopItem.item.title} (${upcomingTopItem.timing.label})`
                : "No upcoming tasks"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFocusMode("ACTION_NEEDED")}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              focusMode === "ACTION_NEEDED"
                ? "border-rose-300 bg-rose-50"
                : "dash-border dash-bg-card",
            )}
          >
            <p className="text-xs uppercase tracking-wide dash-text-muted">
              Overdue
            </p>
            <p className="mt-1 text-lg font-semibold dash-text">
              {groupedItems.attention.length} needs action
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFocusMode("REJECTED")}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              focusMode === "REJECTED"
                ? "border-rose-300 bg-rose-50"
                : "dash-border dash-bg-card",
            )}
          >
            <p className="text-xs uppercase tracking-wide dash-text-muted">
              Rejected
            </p>
            <p className="mt-1 text-lg font-semibold dash-text">
              {
                timedItems.filter(
                  ({ effectiveStatus }) =>
                    effectiveStatus === "REJECTED" ||
                    effectiveStatus === "CANCELLED",
                ).length
              }{" "}
              archived
            </p>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              focusMode === "ALL"
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "dash-border dash-text-muted",
            )}
            onClick={() => setFocusMode("ALL")}
          >
            All
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              focusMode === "NOW"
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "dash-border dash-text-muted",
            )}
            onClick={() => setFocusMode("NOW")}
          >
            Now
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              focusMode === "NEXT"
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "dash-border dash-text-muted",
            )}
            onClick={() => setFocusMode("NEXT")}
          >
            Next
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              focusMode === "ACTION_NEEDED"
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "dash-border dash-text-muted",
            )}
            onClick={() => setFocusMode("ACTION_NEEDED")}
          >
            Action needed
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              focusMode === "REJECTED"
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "dash-border dash-text-muted",
            )}
            onClick={() => setFocusMode("REJECTED")}
          >
            Rejected
          </button>
          {commandFilter === "UNPAID" ? (
            <button
              type="button"
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
              onClick={() => setCommandFilter("ALL")}
            >
              Show all deals
            </button>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {isInitialLoading ? (
            <>
              <DealCardSkeleton />
              <DealCardSkeleton />
              <DealCardSkeleton />
            </>
          ) : visibleTimedItems.length === 0 ? (
            <p className="rounded-xl border border-dashed dash-border px-4 py-8 text-center text-sm dash-text-muted">
              No deals yet
            </p>
          ) : (
            <div
              ref={listParentRef}
              className="relative max-h-[72vh] space-y-5 overflow-auto pr-1 touch-pan-y [overscroll-behavior-y:contain]"
              onTouchStart={pullToRefresh.handleTouchStart}
              onTouchMove={pullToRefresh.handleTouchMove}
              onTouchEnd={pullToRefresh.handleTouchEnd}
              onTouchCancel={pullToRefresh.handleTouchCancel}
            >
              <div className="pointer-events-none sticky top-0 z-20 flex justify-center py-2">
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

              <div style={pullToRefresh.containerStyle} className="space-y-5">
                {sections.map((section) => {
                  const hideForFocusedMode =
                    (focusMode === "NOW" && section.key !== "now") ||
                    (focusMode === "NEXT" && section.key !== "next") ||
                    (focusMode === "REJECTED" && section.key !== "later") ||
                    (focusMode === "ACTION_NEEDED" &&
                      section.key !== "attention" &&
                      section.key !== "now");

                  if (hideForFocusedMode) {
                    return null;
                  }

                  return (
                    <section key={section.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide dash-text-muted">
                          {section.title}
                        </h2>
                        <span className="text-xs dash-text-muted">
                          {section.items.length}
                        </span>
                      </div>

                      {section.items.length === 0 ? (
                        <p className="rounded-xl border border-dashed dash-border px-4 py-4 text-sm dash-text-muted">
                          {section.emptyLabel}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {section.items.map(
                            ({ item: deal, effectiveStatus, timing }) => {
                              const normalizedCurrency =
                                deal.currency === "USD" ||
                                deal.currency === "INR"
                                  ? deal.currency
                                  : null;

                              return (
                                <DealCardWithMenu
                                  key={deal.id}
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
                                  onOpen={() =>
                                    router.push(`/deals/${deal.id}`)
                                  }
                                  onStatusUpdated={(dealId, status) => {
                                    setOptimisticStatusById((previous) => ({
                                      ...previous,
                                      [dealId]:
                                        status === "INBOUND" ||
                                        status === "NEGOTIATING" ||
                                        status === "AGREED" ||
                                        status === "POSTED" ||
                                        status === "PAID" ||
                                        status === "CANCELLED" ||
                                        status === "REJECTED"
                                          ? status
                                          : "INBOUND",
                                    }));
                                  }}
                                  className={cn(
                                    "pillowy-card transition-all hover:-translate-y-0.5 hover:shadow-md",
                                    timing.lane === "ATTENTION" &&
                                      "border-rose-300/70 ring-1 ring-rose-200/70",
                                  )}
                                >
                                  <div className="group relative p-4">
                                    <div className="flex items-start gap-4">
                                      <BrandAvatar
                                        name={deal.brand?.name ?? "?"}
                                      />

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h3 className="truncate font-semibold dash-text transition-colors group-hover:gold-text">
                                            {deal.title}
                                          </h3>
                                          <span
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                                              lanePillClasses(timing.lane),
                                            )}
                                          >
                                            {laneIcon(timing.lane)}
                                            {laneLabel(timing.lane)}
                                          </span>
                                        </div>

                                        <p className="mt-1 text-sm font-medium dash-text">
                                          {timing.label}
                                          <span className="mx-2 dash-text-muted">
                                            •
                                          </span>
                                          <span className="text-sm dash-text-muted">
                                            {timing.exact}
                                          </span>
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs dash-text-muted">
                                          <span className="font-medium dash-text">
                                            {deal.brand?.name ??
                                              "Unknown brand"}
                                          </span>
                                          <span>•</span>
                                          <StatusBadge
                                            status={effectiveStatus}
                                            className="text-[10px]"
                                          />
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

                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full dash-bg-card">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          timing.lane === "ATTENTION"
                                            ? "bg-rose-500"
                                            : timing.lane === "NOW"
                                              ? "bg-emerald-500"
                                              : timing.lane === "NEXT"
                                                ? "bg-blue-500"
                                                : "bg-slate-400",
                                        )}
                                        style={{
                                          width: `${timing.progressPercent}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </DealCardWithMenu>
                              );
                            },
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
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
