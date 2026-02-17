"use client";

import type { User } from "@supabase/supabase-js";
import { formatDistanceStrict } from "date-fns";
import {
  Bot,
  Clock3,
  CreditCard,
  LineChart,
  PlusCircle,
  TriangleAlert,
  Wallet,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false },
);
const AreaChart = dynamic(
  () => import("recharts").then((mod) => mod.AreaChart),
  {
    ssr: false,
  },
);
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});

import { Badge } from "@/components/ui/badge";
import { PillowyCard } from "@/components/ui/pillowy-card";
import { createClient } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { DeadlineStateBadge } from "@/src/components/deliverables/DeadlineStateBadge";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";
import { usePullToRefresh } from "@/src/hooks/usePullToRefresh";
import {
  formatDayLabel,
  formatDealCurrency,
  formatTime,
} from "@/src/lib/utils/format-utils";
import {
  getDealStatusTone,
  getStatusBadgeClasses,
} from "@/src/lib/utils/status-utils";

function compactCurrency(value: number, currency: "USD" | "INR") {
  return formatDealCurrency(value, { currency, compact: true });
}

function formatUSDValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyValue(value: number, currency: string) {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function readMetadataString(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function firstToken(value: string) {
  return value.trim().split(/\s+/)[0] ?? "";
}

function resolveDisplayName(user: User | null) {
  if (!user) {
    return "Creator";
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = readMetadataString(metadata, ["full_name", "name"]);
  if (fullName) {
    const firstNameFromFull = firstToken(fullName);
    return firstNameFromFull.length > 0 ? firstNameFromFull : "Creator";
  }

  const firstName = readMetadataString(metadata, ["first_name", "given_name"]);
  if (firstName) {
    return firstToken(firstName);
  }

  return "Creator";
}

type TimelineItem = {
  id: string;
  dealId: string;
  dealTitle: string;
  platform: string;
  type: string;
  scheduledAt: Date | null;
  status: string;
  deadline_state:
    | "COMPLETED"
    | "ON_TRACK"
    | "DUE_SOON"
    | "DUE_TODAY"
    | "LATE"
    | "LATE_1D"
    | "LATE_3D";
  deadline_state_reason: string;
};

function DeliverablesTimeline({
  items,
  onOpenDeal,
}: {
  items: TimelineItem[];
  onOpenDeal: (dealId: string) => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

  const todayItems: TimelineItem[] = [];
  const tomorrowItems: TimelineItem[] = [];
  const thisWeekMap = new Map<string, TimelineItem[]>();

  for (const item of items) {
    if (!item.scheduledAt) {
      continue;
    }

    const scheduled = new Date(item.scheduledAt);
    const key = `${scheduled.getFullYear()}-${scheduled.getMonth()}-${scheduled.getDate()}`;

    if (scheduled >= todayStart && scheduled < tomorrowStart) {
      todayItems.push(item);
      continue;
    }

    if (scheduled >= tomorrowStart && scheduled < dayAfterTomorrowStart) {
      tomorrowItems.push(item);
      continue;
    }

    const bucket = thisWeekMap.get(key) ?? [];
    bucket.push(item);
    thisWeekMap.set(key, bucket);
  }

  const thisWeekGroups = [...thisWeekMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, groupedItems]) => ({
      date: groupedItems[0]?.scheduledAt
        ? new Date(groupedItems[0].scheduledAt)
        : null,
      items: groupedItems.sort((a, b) => {
        const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return aTime - bTime;
      }),
    }));

  const hasAny =
    todayItems.length > 0 ||
    tomorrowItems.length > 0 ||
    thisWeekGroups.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm dash-text-muted">
        No deliverables scheduled in the next 7 days.
      </p>
    );
  }

  const renderItem = (item: TimelineItem) => {
    if (!item.scheduledAt) {
      return null;
    }

    const isLate =
      item.deadline_state === "LATE" ||
      item.deadline_state === "LATE_1D" ||
      item.deadline_state === "LATE_3D";
    const isDueToday = item.deadline_state === "DUE_TODAY";

    // Use standard border logic for timeline items inside the pillowy card
    const borderClass = isLate
      ? "dash-inline-card dash-card-danger"
      : isDueToday
        ? "dash-inline-card dash-card-warn"
        : "dash-inline-card";

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onOpenDeal(item.dealId)}
        className={`w-full rounded-xl border p-3 text-left transition-opacity hover:opacity-95 ${borderClass}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium dash-text">{item.dealTitle}</p>
          <DeadlineStateBadge
            state={item.deadline_state}
            reason={item.deadline_state_reason}
          />
        </div>
        <p className="mt-1 text-sm dash-text-muted">
          {item.platform} · {item.type}
        </p>
        <p
          className={`text-xs ${isLate ? "dash-text-danger" : "dash-text-muted"}`}
        >
          {item.deadline_state_reason} · {formatTime(item.scheduledAt)}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {todayItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide dash-text-muted">
            Today
          </p>
          {todayItems.map(renderItem)}
        </div>
      ) : null}

      {tomorrowItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide dash-text-muted">
            Tomorrow
          </p>
          {tomorrowItems.map(renderItem)}
        </div>
      ) : null}

      {thisWeekGroups.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide dash-text-muted">
            This Week
          </p>
          {thisWeekGroups.map((group) => (
            <div
              key={group.date ? group.date.toISOString() : "unknown"}
              className="space-y-2"
            >
              {group.date ? (
                <p className="text-xs font-medium dash-text-muted">
                  {formatDayLabel(group.date, now)}
                </p>
              ) : null}
              {group.items.map(renderItem)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function _chipToneClasses(tone: "green" | "yellow" | "red" | "blue") {
  if (tone === "green") {
    return "dash-chip-tone-green";
  }
  if (tone === "yellow") {
    return "dash-chip-tone-yellow";
  }
  if (tone === "red") {
    return "dash-chip-tone-red";
  }
  return "dash-chip-tone-blue";
}

function _reminderPriorityTone(priority: "LOW" | "MED" | "HIGH" | "CRITICAL") {
  if (priority === "CRITICAL") {
    return "dash-chip-tone-red";
  }
  if (priority === "HIGH") {
    return "dash-chip-tone-yellow";
  }
  if (priority === "MED") {
    return "dash-chip-tone-yellow";
  }
  return "dash-chip-tone-blue";
}

function _formatReminderRelative(dueAt: Date | string) {
  const now = new Date();
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const distance = formatDistanceStrict(due, now);

  if (due > now) {
    return `Due in ${distance}`;
  }

  return `Overdue by ${distance}`;
}

function StatCardSkeleton() {
  return (
    <PillowyCard className="p-6 h-40 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="h-8 w-8 rounded-full animate-pulse dash-skeleton" />
      </div>
      <div>
        <div className="h-3 w-16 mb-2 animate-pulse rounded dash-skeleton" />
        <div className="h-6 w-24 animate-pulse rounded dash-skeleton" />
      </div>
    </PillowyCard>
  );
}

function SectionCardSkeleton({ rows = 4 }: { rows?: number }) {
  const rowIds = Array.from({ length: rows }, (_, rowNumber) => rowNumber + 1);
  return (
    <PillowyCard className="p-6">
      <div className="h-5 w-40 animate-pulse rounded dash-skeleton mb-6" />
      <div className="space-y-3">
        {rowIds.map((rowId) => (
          <div
            key={`row-${rowId}`}
            className="h-12 w-full animate-pulse rounded-xl dash-skeleton"
          />
        ))}
      </div>
    </PillowyCard>
  );
}

function RevenueChartSkeleton() {
  return (
    <PillowyCard className="p-6 h-64">
      <div className="h-full w-full animate-pulse rounded-xl dash-skeleton" />
    </PillowyCard>
  );
}

function QuickActionsCard({
  overdueItemsCount,
  outstandingTotal,
  activeDealsCount,
}: {
  overdueItemsCount: number;
  outstandingTotal: number;
  activeDealsCount: number;
}) {
  const router = useRouter();
  const hasOverdue = overdueItemsCount > 0;
  const hasOutstanding = outstandingTotal > 0;
  const actions = [
    {
      label: "New Deal",
      href: "/deals/new",
      icon: PlusCircle,
      highlight: true,
      shortcut: "N",
    },
    hasOverdue
      ? {
          label: "Overdue",
          href: "/deals",
          icon: TriangleAlert,
          highlight: true,
          shortcut: null,
        }
      : {
          label: "AI Script",
          href: "/deals/ai-create",
          icon: Bot,
          highlight: false,
          shortcut: "K",
        },
    hasOutstanding
      ? {
          label: "Collect",
          href: "/payments/new",
          icon: CreditCard,
          highlight: true,
          shortcut: null,
        }
      : {
          label: "Invoice",
          href: "/payments/new",
          icon: CreditCard,
          highlight: false,
          shortcut: null,
        },
    activeDealsCount > 0
      ? {
          label: "Pipeline",
          href: "/deals",
          icon: LineChart,
          highlight: true,
          shortcut: null,
        }
      : {
          label: "Analytics",
          href: "/analytics",
          icon: LineChart,
          highlight: false,
          shortcut: null,
        },
  ] as const;

  return (
    <section>
      <h3 className="font-serif text-xl dash-text mb-4">Tactile Actions</h3>
      <div className="grid grid-cols-4 gap-4">
        {actions.map((action) => {
          const isHighlight = action.highlight;
          const Icon = action.icon;
          return (
            <div key={action.href} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(action.href)}
                className="pillowy-card w-full aspect-square flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              >
                <Icon
                  className={cn(
                    "h-6 w-6 md:h-5 md:w-5",
                    isHighlight ? "icon-3d-gold dash-link" : "dash-text-muted",
                  )}
                />
              </button>
              <span className="text-[10px] font-semibold dash-text-muted">
                {action.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { defaultCurrency } = useDefaultCurrency();
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [displayName, setDisplayName] = useState("Creator");
  const statsQuery = trpc.analytics.getDashboardStats.useQuery(undefined, {
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
    placeholderData: (previous) => previous,
  });
  const remindersQuery = trpc.reminders.listOpen.useQuery(undefined, {
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
    placeholderData: (previous) => previous,
  });
  const currencyBreakdownQuery = trpc.analytics.getCurrencyBreakdown.useQuery(
    undefined,
    {
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchInterval: 20_000,
      placeholderData: (previous) => previous,
    },
  );

  const refreshDashboard = useCallback(async () => {
    await Promise.all([statsQuery.refetch(), remindersQuery.refetch()]);
  }, [remindersQuery, statsQuery]);

  const pullToRefresh = usePullToRefresh({
    scrollRef: dashboardRef,
    onRefresh: refreshDashboard,
    disabled: statsQuery.isFetching || remindersQuery.isFetching,
  });

  const stats = statsQuery.data;
  const currencyBreakdown = currencyBreakdownQuery.data;
  const _hasOutstanding = (stats?.totalOutstandingPayments ?? 0) > 0;
  const _hasOverdue = (stats?.overdueItemsCount ?? 0) > 0;
  const unconvertedCurrencies =
    currencyBreakdown?.currencies.filter(
      (item) => item.totalUsd === null && item.paymentCount > 0,
    ) ?? [];
  const unconvertedSummary = unconvertedCurrencies
    .map(
      (item) =>
        `${formatCurrencyValue(item.totalOriginal, item.currency)} ${item.currency}`,
    )
    .join(" + ");
  const dashboardSubtitle =
    (stats?.overdueItemsCount ?? 0) > 0
      ? `${stats?.overdueItemsCount ?? 0} item(s) need attention today.`
      : (stats?.activeDealsCount ?? 0) > 0
        ? `${stats?.activeDealsCount ?? 0} active deal(s) in motion.`
        : "No active deals yet. Add one to start your pipeline.";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key.toLowerCase() === "n" && isMeta) {
        event.preventDefault();
        router.push("/deals/new");
      }

      if (event.key.toLowerCase() === "k" && isMeta) {
        event.preventDefault();
        router.push("/deals/ai-create");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setDisplayName(resolveDisplayName(data.user ?? null));
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      ref={dashboardRef}
      className="space-y-8 touch-pan-y"
      onTouchStart={pullToRefresh.handleTouchStart}
      onTouchMove={pullToRefresh.handleTouchMove}
      onTouchEnd={pullToRefresh.handleTouchEnd}
      onTouchCancel={pullToRefresh.handleTouchCancel}
    >
      <section>
        <h2 className="font-serif text-3xl dash-text">
          Welcome, <span className="gold-text italic">{displayName}</span>
        </h2>
        <p className="dash-text-muted text-sm mt-1">{dashboardSubtitle}</p>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <PillowyCard className="p-5 flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <Wallet className="h-8 w-8 md:h-6 md:w-6 icon-3d-gold dash-link" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider dash-text-muted font-semibold mb-1">
                  Revenue
                </p>
                <p className="text-xl font-bold dash-text tracking-tight">
                  {formatUSDValue(stats?.totalRevenueAllTime ?? 0)} USD
                </p>
                {(currencyBreakdown?.currencies.length ?? 0) > 0 &&
                !currencyBreakdown?.hasUnconvertedPayments ? (
                  <p className="text-[11px] dash-text-muted mt-1">
                    {currencyBreakdown?.currencies.length ?? 0} currencies · ECB
                    rates
                  </p>
                ) : null}
                {currencyBreakdown?.hasUnconvertedPayments ? (
                  <>
                    <p className="text-[11px] mt-1 dash-text-danger">
                      + {unconvertedSummary} unconverted
                    </p>
                    <p className="text-[11px] dash-text-muted">
                      <Link
                        href="/payments/new"
                        className="underline underline-offset-2"
                      >
                        Add rates
                      </Link>{" "}
                      to see total
                    </p>
                  </>
                ) : null}
              </div>
            </PillowyCard>

            <PillowyCard className="p-5 flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <Clock3 className="h-8 w-8 md:h-6 md:w-6 icon-3d-gold dash-link" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider dash-text-muted font-semibold mb-1">
                  Outstanding
                </p>
                <p className="text-xl font-bold dash-text tracking-tight">
                  {compactCurrency(
                    stats?.totalOutstandingPayments ?? 0,
                    defaultCurrency,
                  )}
                </p>
              </div>
            </PillowyCard>

            <PillowyCard className="p-5 flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <Zap className="h-8 w-8 md:h-6 md:w-6 icon-3d-gold dash-link" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider dash-text-muted font-semibold mb-1">
                  Active Deals
                </p>
                <p className="text-xl font-bold dash-text tracking-tight">
                  {stats?.activeDealsCount ?? 0}
                </p>
              </div>
            </PillowyCard>

            <PillowyCard className="p-5 flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <Bot className="h-8 w-8 md:h-6 md:w-6 icon-3d-gold dash-link" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider dash-text-muted font-semibold mb-1">
                  Overdue
                </p>
                <p className="text-xl font-bold dash-text tracking-tight">
                  {stats?.overdueItemsCount ?? 0}
                </p>
              </div>
            </PillowyCard>
          </>
        )}
      </div>

      {!currencyBreakdownQuery.isLoading && currencyBreakdown ? (
        <section>
          <details className="dash-inline-card rounded-2xl border p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold dash-text">
              Revenue by Currency
            </summary>
            <div className="mt-4 space-y-3">
              {currencyBreakdown.currencies.map((item) => (
                <div
                  key={item.currency}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium dash-text">{item.currency}</span>
                  <span className="dash-text-muted">
                    {formatCurrencyValue(item.totalOriginal, item.currency)} (
                    {item.paymentCount} payments)
                  </span>
                  <span className="dash-text">
                    {item.totalUsd !== null
                      ? `= ${formatUSDValue(item.totalUsd)} USD`
                      : "Unconverted"}
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold dash-text">
                  Total ~{formatUSDValue(currencyBreakdown.totalUsdEquivalent)}{" "}
                  USD equivalent
                </p>
                <p className="text-xs dash-text-muted">
                  Rates: ECB reference rates
                </p>
                {currencyBreakdown.hasUnconvertedPayments ? (
                  <p className="text-xs dash-text-danger mt-1">
                    ⚠️ {currencyBreakdown.unconvertedCount} payment(s) in other
                    currencies not included in total. Add exchange rates to see
                    complete revenue.
                  </p>
                ) : null}
              </div>
            </div>
          </details>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl dash-text">Revenue Flow</h3>
        </div>
        {statsQuery.isLoading ? (
          <RevenueChartSkeleton />
        ) : (
          <PillowyCard className="p-6 h-64 min-h-[16rem] relative overflow-hidden">
            {/* Decorative background grid from design */}
            <div className="dash-chart-dots absolute inset-0 opacity-10"></div>

            <div className="relative h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.revenueTrend}>
                  <defs>
                    <linearGradient
                      id="goldGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--shell-gold)"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--shell-gold)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--shell-panel-hover)",
                      borderRadius: "12px",
                      border: "1px solid var(--shell-border)",
                    }}
                    itemStyle={{ color: "var(--shell-gold)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--shell-gold)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#goldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PillowyCard>
        )}
      </section>

      <QuickActionsCard
        overdueItemsCount={stats?.overdueItemsCount ?? 0}
        outstandingTotal={stats?.totalOutstandingPayments ?? 0}
        activeDealsCount={stats?.activeDealsCount ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statsQuery.isLoading ? (
          <SectionCardSkeleton rows={4} />
        ) : !statsQuery.isError ? (
          <PillowyCard className="p-0">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-xl dash-text">Ongoing Affairs</h3>
              <Link
                href="/deals"
                className="text-[10px] font-bold gold-text uppercase tracking-widest"
              >
                View All
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {(stats?.recentDeals.length ?? 0) === 0 ? (
                <p className="text-sm dash-text-muted p-4">No recent deals.</p>
              ) : (
                stats?.recentDeals.map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    className="dash-inline-card w-full flex items-center justify-between p-4 rounded-2xl border transition-colors hover:opacity-95 cursor-pointer text-left"
                    onClick={() => router.push(`/deals/${deal.id}`)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="w-10 h-10 rounded-xl pillowy-card flex items-center justify-center">
                        <Wallet className="h-5 w-5 icon-3d-gold dash-link" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold dash-text">
                          {deal.title}
                        </p>
                        <p className="truncate text-[10px] dash-text-muted">
                          {deal.brandName}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-sm font-bold gold-text">
                        {formatDealCurrency(Number(deal.totalValue ?? 0), {
                          currency: deal.currency,
                        })}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          getStatusBadgeClasses(getDealStatusTone(deal.status)),
                        )}
                      >
                        {deal.status}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PillowyCard>
        ) : null}

        {statsQuery.isLoading ? (
          <SectionCardSkeleton rows={3} />
        ) : (
          <PillowyCard className="p-0">
            <div className="p-6 border-b border-border">
              <h3 className="font-serif text-xl dash-text">
                Upcoming Deliverables
              </h3>
            </div>
            <div className="p-6">
              <DeliverablesTimeline
                items={
                  stats?.upcomingDeliverables.map((deliverable) => ({
                    id: deliverable.id,
                    dealId: deliverable.dealId,
                    dealTitle: deliverable.dealTitle,
                    platform: deliverable.platform,
                    type: deliverable.type,
                    scheduledAt: deliverable.scheduledAt,
                    status: deliverable.status,
                    deadline_state: deliverable.deadline_state,
                    deadline_state_reason: deliverable.deadline_state_reason,
                  })) ?? []
                }
                onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
              />
            </div>
          </PillowyCard>
        )}
      </div>
    </div>
  );
}
