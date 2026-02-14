"use client";

import {
  Bot,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LineChart,
  PlusCircle,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrencyWithCode(value: number, currency: string | null) {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  }

  return formatCurrency(value);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDayLabel(value: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(value.getFullYear(), value.getMonth(), value.getDate());

  if (target.getTime() === today.getTime()) {
    return "Today";
  }
  if (target.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dealStatusTone(status: string | null) {
  if (status === "PAID" || status === "AGREED") {
    return "green" as const;
  }
  if (status === "NEGOTIATING") {
    return "yellow" as const;
  }
  if (status === "INBOUND") {
    return "blue" as const;
  }
  return "blue" as const;
}

type TimelineItem = {
  id: string;
  dealId: string;
  dealTitle: string;
  platform: string;
  type: string;
  scheduledAt: Date | null;
  status: string;
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
      date: groupedItems[0]?.scheduledAt ? new Date(groupedItems[0].scheduledAt) : null,
      items: groupedItems.sort((a, b) => {
        const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return aTime - bTime;
      }),
    }));

  const hasAny =
    todayItems.length > 0 || tomorrowItems.length > 0 || thisWeekGroups.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-gray-500">
        No deliverables scheduled in the next 7 days.
      </p>
    );
  }

  const renderItem = (item: TimelineItem) => {
    if (!item.scheduledAt) {
      return null;
    }

    const isOverdue = new Date(item.scheduledAt) < now;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onOpenDeal(item.dealId)}
        className={`w-full rounded-xl border p-3 text-left ${
          isOverdue
            ? "border-rose-200 bg-rose-50/40"
            : "border-gray-100 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-gray-900">{item.dealTitle}</p>
          <Badge
            variant="outline"
            className={chipToneClasses(isOverdue ? "red" : "blue")}
          >
            {item.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {item.platform} · {item.type}
        </p>
        <p className={`text-xs ${isOverdue ? "text-rose-700" : "text-gray-500"}`}>
          {isOverdue ? "Overdue " : "Scheduled "}
          {formatTime(item.scheduledAt)}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {todayItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Today
          </p>
          {todayItems
            .sort((a, b) => {
              const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
              const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
              return aTime - bTime;
            })
            .map(renderItem)}
        </div>
      ) : null}

      {tomorrowItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tomorrow
          </p>
          {tomorrowItems
            .sort((a, b) => {
              const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
              const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
              return aTime - bTime;
            })
            .map(renderItem)}
        </div>
      ) : null}

      {thisWeekGroups.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            This Week
          </p>
          {thisWeekGroups.map((group) => (
            <div key={group.date ? group.date.toISOString() : "unknown"} className="space-y-2">
              {group.date ? (
                <p className="text-xs font-medium text-gray-500">
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

function cardToneClasses(tone: "green" | "yellow" | "red" | "blue") {
  if (tone === "green") {
    return "border-emerald-100 bg-emerald-50/40 shadow-[0_8px_24px_rgba(16,185,129,0.10)]";
  }
  if (tone === "yellow") {
    return "border-amber-100 bg-amber-50/40 shadow-[0_8px_24px_rgba(245,158,11,0.10)]";
  }
  if (tone === "red") {
    return "border-rose-100 bg-rose-50/40 shadow-[0_8px_24px_rgba(244,63,94,0.10)]";
  }
  return "border-blue-100 bg-blue-50/40 shadow-[0_8px_24px_rgba(59,130,246,0.10)]";
}

function chipToneClasses(tone: "green" | "yellow" | "red" | "blue") {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (tone === "yellow") {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }
  if (tone === "red") {
    return "border-rose-200 bg-rose-100 text-rose-700";
  }
  return "border-blue-200 bg-blue-100 text-blue-700";
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-2">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
      </CardContent>
    </Card>
  );
}

function SectionCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`row-${index}`}
            className="h-12 w-full animate-pulse rounded-xl bg-gray-200"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RevenueChartSkeleton() {
  return (
    <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full animate-pulse rounded-xl bg-gray-200" />
      </CardContent>
    </Card>
  );
}

function QuickActionsCard() {
  const actions = [
    {
      label: "New Deal",
      href: "/deals/new",
      icon: PlusCircle,
      hint: "Cmd/Ctrl+N",
    },
    {
      label: "AI Create Deal",
      href: "/deals/ai-create",
      icon: Bot,
      hint: "Cmd/Ctrl+K",
    },
    {
      label: "Add Payment",
      href: "/payments/new",
      icon: CreditCard,
      hint: "Coming soon",
    },
    {
      label: "View Analytics",
      href: "/analytics",
      icon: LineChart,
      hint: "Phase 13",
    },
  ] as const;

  return (
    <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-600 transition-colors group-hover:text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {action.label}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500">{action.hint}</span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const statsQuery = trpc.analytics.getDashboardStats.useQuery(undefined, {
    staleTime: 30_000,
  });

  const stats = statsQuery.data;
  const hasOutstanding = (stats?.totalOutstandingPayments ?? 0) > 0;
  const hasOverdue = (stats?.overdueItemsCount ?? 0) > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) {
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/deals/new");
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/deals/ai-create");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500">
          Snapshot of revenue, payments, deliverables, and urgent actions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card className={`rounded-2xl ${cardToneClasses("green")}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Total Revenue (This Month)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.totalRevenueThisMonth ?? 0)}
                </p>
                <Badge variant="outline" className={chipToneClasses("green")}>
                  <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
                  Good
                </Badge>
              </CardContent>
            </Card>

            <Card
              className={`rounded-2xl ${cardToneClasses(
                hasOutstanding ? "yellow" : "green",
              )}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Outstanding Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.totalOutstandingPayments ?? 0)}
                </p>
                <Badge
                  variant="outline"
                  className={chipToneClasses(hasOutstanding ? "yellow" : "green")}
                >
                  <Clock3 className="mr-1 h-3.5 w-3.5" />
                  {hasOutstanding ? "Warning" : "Clear"}
                </Badge>
              </CardContent>
            </Card>

            <Card className={`rounded-2xl ${cardToneClasses("blue")}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Upcoming Deliverables (7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.upcomingDeliverablesCount ?? 0}
                </p>
                <Badge variant="outline" className={chipToneClasses("blue")}>
                  <CalendarCheck className="mr-1 h-3.5 w-3.5" />
                  Info
                </Badge>
              </CardContent>
            </Card>

            <Card
              className={`rounded-2xl ${cardToneClasses(
                hasOverdue ? "red" : "green",
              )}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Overdue Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.overdueItemsCount ?? 0}
                </p>
                <Badge
                  variant="outline"
                  className={chipToneClasses(hasOverdue ? "red" : "green")}
                >
                  <TriangleAlert className="mr-1 h-3.5 w-3.5" />
                  {hasOverdue ? "Alert" : "Good"}
                </Badge>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {statsQuery.isError ? (
        <Card className="rounded-2xl border-rose-100 bg-rose-50/40">
          <CardContent className="p-6 text-sm text-rose-700">
            Could not load dashboard analytics right now.
          </CardContent>
        </Card>
      ) : null}

      <QuickActionsCard />

      {statsQuery.isLoading ? <RevenueChartSkeleton /> : null}

      {!statsQuery.isLoading && !statsQuery.isError ? (
        <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.revenueTrend.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No revenue data yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.revenueTrend} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => compactCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                      cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {statsQuery.isLoading ? (
        <>
          <SectionCardSkeleton rows={4} />
          <SectionCardSkeleton rows={4} />
        </>
      ) : null}

      {!statsQuery.isLoading && !statsQuery.isError ? (
        <>
          <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Recent Deals</CardTitle>
              <Link
                href="/deals"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All
              </Link>
            </CardHeader>
            <CardContent>
              {(stats?.recentDeals.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500">No recent deals yet.</p>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Brand</TableHead>
                          <TableHead>Deal</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats?.recentDeals.map((deal) => {
                          const tone = dealStatusTone(deal.status);
                          return (
                            <TableRow
                              key={deal.id}
                              className="cursor-pointer"
                              onClick={() => router.push(`/deals/${deal.id}`)}
                            >
                              <TableCell className="font-medium">
                                {deal.brandName}
                              </TableCell>
                              <TableCell>{deal.title}</TableCell>
                              <TableCell>
                                {formatCurrencyWithCode(
                                  Number(deal.totalValue ?? 0),
                                  deal.currency,
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={chipToneClasses(tone)}
                                >
                                  {deal.status ?? "UNKNOWN"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(deal.createdAt)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {stats?.recentDeals.map((deal) => {
                      const tone = dealStatusTone(deal.status);
                      return (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => router.push(`/deals/${deal.id}`)}
                          className="w-full rounded-xl border border-gray-100 bg-white p-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {deal.title}
                              </p>
                              <p className="text-sm text-gray-500">
                                {deal.brandName}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={chipToneClasses(tone)}
                            >
                              {deal.status ?? "UNKNOWN"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">
                            {formatCurrencyWithCode(
                              Number(deal.totalValue ?? 0),
                              deal.currency,
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            Created {formatDate(deal.createdAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Upcoming Deliverables</CardTitle>
            </CardHeader>
            <CardContent>
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
                  })) ?? []
                }
                onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
