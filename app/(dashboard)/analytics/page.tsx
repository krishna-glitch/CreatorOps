"use client";

import { BarChart3, Download, Filter, RefreshCcw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";

const CHART_COLORS = {
  revenue: "var(--shell-gold)",
  revenueFill: "var(--shell-gold)",
  grid: "var(--shell-chart-grid)",
  text: "var(--shell-text-muted)",
  platform: ["#d4af37", "#be9124", "#8a6d3b", "#f9e29c", "#947428"],
  brands: "var(--shell-gold)",
  funnel: ["#f9e29c", "#d4af37", "#be9124", "#8a6d3b"],
};

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

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const endExclusive = new Date(`${endDate}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return {
    start_date: start.toISOString(),
    end_date: endExclusive.toISOString(),
  };
}

function escapeCsvField(value: string | number) {
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="dash-bg-card flex h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed dash-border px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full dash-bg-card">
        <BarChart3 className="h-5 w-5 dash-text-muted" />
      </div>
      <p className="max-w-[260px] text-sm leading-relaxed dash-text-muted">
        {message}
      </p>
    </div>
  );
}

function LoadingChartState() {
  return (
    <div className="space-y-3">
      <div className="h-[260px] animate-pulse rounded-xl dash-bg-card" aria-hidden="true" />
      <div className="flex gap-4">
        <div className="h-3 w-20 animate-pulse rounded dash-bg-card" />
        <div className="h-3 w-16 animate-pulse rounded dash-bg-card" />
        <div className="h-3 w-24 animate-pulse rounded dash-bg-card" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [startDate, setStartDate] = useState<string>(toDateInput(defaultStart));
  const [endDate, setEndDate] = useState<string>(toDateInput(now));

  const rangeInput = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) {
      return undefined;
    }
    return toIsoRange(startDate, endDate);
  }, [startDate, endDate]);

  const insightsQuery = trpc.analytics.getAdvancedInsights.useQuery(
    rangeInput,
    {
      staleTime: 30_000,
      enabled: Boolean(rangeInput),
    },
  );

  const insights = insightsQuery.data;

  const topBrands = useMemo(
    () => (insights?.revenueByBrand ?? []).slice(0, 10),
    [insights?.revenueByBrand],
  );

  const pipelineData = useMemo(() => {
    const source = insights?.dealPipeline;
    if (!source) {
      return [];
    }

    return [
      { stage: "Inbound", value: source.inbound },
      { stage: "Negotiating", value: source.negotiating },
      { stage: "Won", value: source.won },
      { stage: "Lost", value: source.lost },
    ];
  }, [insights?.dealPipeline]);

  const hasRevenueTrend = (insights?.revenueByMonth.length ?? 0) > 0;
  const hasPlatformData = (insights?.revenueByPlatform.length ?? 0) > 0;
  const hasBrandData = topBrands.length > 0;
  const hasPipelineData = pipelineData.some((item) => item.value > 0);

  const exportCsv = () => {
    if (!insights) {
      return;
    }

    const rows: string[][] = [
      ["section", "label", "value", "secondary_value"],
      ["meta", "start_date", insights.range.startDate, ""],
      ["meta", "end_date", insights.range.endDate, ""],
      ["summary", "average_deal_size", insights.averageDealSize.toString(), ""],
      [
        "summary",
        "average_response_time_hours",
        insights.averageResponseTimeHours.toString(),
        "",
      ],
      [
        "summary",
        "on_time_delivery_rate",
        insights.onTimeDeliveryRate.toString(),
        "",
      ],
      [
        "summary",
        "average_revision_count",
        insights.averageRevisionCount.toString(),
        "",
      ],
      ["summary", "deals_won", insights.dealsWonVsLost.won.toString(), ""],
      ["summary", "deals_lost", insights.dealsWonVsLost.lost.toString(), ""],
    ];

    for (const point of insights.revenueByMonth) {
      rows.push([
        "revenue_by_month",
        point.monthKey,
        point.revenue.toString(),
        point.label,
      ]);
    }

    for (const point of insights.revenueByPlatform) {
      rows.push([
        "revenue_by_platform",
        point.platform,
        point.revenue.toString(),
        "",
      ]);
    }

    for (const point of insights.revenueByBrand) {
      rows.push([
        "revenue_by_brand",
        point.brandName,
        point.revenue.toString(),
        point.brandId,
      ]);
    }

    for (const point of pipelineData) {
      rows.push(["deal_pipeline", point.stage, point.value.toString(), ""]);
    }

    const csv = rows
      .map((row) => row.map((field) => escapeCsvField(field)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytics_${startDate}_to_${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight dash-text">Analytics</h1>
          <p className="dash-text-muted">
            Revenue, pipeline, and brand performance across your selected range.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="analytics-start-date"
                className="text-xs dash-text-muted"
              >
                Start date
              </label>
              <Input
                id="analytics-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="analytics-end-date"
                className="text-xs dash-text-muted"
              >
                End date
              </label>
              <Input
                id="analytics-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            disabled={!insights || insightsQuery.isLoading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {rangeInput === undefined ? (
        <div className="dash-inline-card dash-chip-tone-yellow rounded-xl border p-3 text-sm">
          <Filter className="mr-1 inline h-4 w-4" />
          Date range is invalid. Ensure start date is before end date.
        </div>
      ) : null}

      {insightsQuery.isError ? (
        <div className="dash-card-danger flex items-center justify-between rounded-xl border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full dash-bg-card">
              <Filter className="h-4 w-4 dash-text-danger" />
            </div>
            <div>
              <p className="text-sm font-medium dash-text">Failed to load analytics</p>
              <p className="text-xs dash-text-muted">
                {insightsQuery.error?.message || "Try adjusting the date range or refreshing."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => insightsQuery.refetch()}
            className="shrink-0"
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      <Card className="dash-card border dash-border">
        <CardHeader>
          <CardTitle className="text-base dash-text">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {insightsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                "insight-loading-1",
                "insight-loading-2",
                "insight-loading-3",
                "insight-loading-4",
              ].map((key) => (
                <div
                  key={key}
                  className="h-20 animate-pulse rounded-lg dash-bg-card"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (insights?.insights.length ?? 0) === 0 ? (
            <p className="text-sm dash-text-muted">
              No statistically significant insights yet for this date range.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {insights?.insights.map((insight) => (
                <div
                  key={insight}
                  className="rounded-lg border dash-border dash-bg-card p-3 text-sm dash-text"
                >
                  {insight}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-card border dash-border">
        <CardHeader>
          <CardTitle className="text-base dash-text">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {insightsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                "recommendation-loading-1",
                "recommendation-loading-2",
                "recommendation-loading-3",
              ].map((key) => (
                <div
                  key={key}
                  className="h-20 animate-pulse rounded-lg dash-bg-card"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (insights?.recommendations.length ?? 0) === 0 ? (
            <p className="text-sm dash-text-muted">
              No recommendations generated for this date range.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {insights?.recommendations.map((recommendation) => (
                <div
                  key={recommendation}
                  className="dash-chip-tone-green rounded-lg border p-3 text-sm"
                >
                  {recommendation}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="dash-card border dash-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm dash-text-muted">
              Average Deal Size
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {insightsQuery.isLoading
              ? "..."
              : formatCurrency(insights?.averageDealSize ?? 0)}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm dash-text-muted">
              Won vs Lost
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {insightsQuery.isLoading ? (
              "..."
            ) : (
              <span>
                Won <strong>{insights?.dealsWonVsLost.won ?? 0}</strong> • Lost{" "}
                <strong>{insights?.dealsWonVsLost.lost ?? 0}</strong>
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm dash-text-muted">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {insightsQuery.isLoading
              ? "..."
              : `${(insights?.averageResponseTimeHours ?? 0).toFixed(1)}h`}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm dash-text-muted">
              On-Time Delivery Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {insightsQuery.isLoading
              ? "..."
              : `${((insights?.onTimeDeliveryRate ?? 0) * 100).toFixed(1)}%`}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="dash-card border dash-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base dash-text">
              <TrendingUp className="h-4 w-4" />
              Revenue Trend (12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsQuery.isLoading ? (
              <LoadingChartState />
            ) : !hasRevenueTrend ? (
              <EmptyChartState message="No revenue records for this date range." />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights?.revenueByMonth}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.grid}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                      tickFormatter={(value) => compactCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value ?? 0)),
                        "Revenue",
                      ]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_COLORS.revenue}
                      strokeWidth={3}
                      dot={{ r: 3, fill: CHART_COLORS.revenueFill }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader>
            <CardTitle className="text-base dash-text">Platform Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {insightsQuery.isLoading ? (
              <LoadingChartState />
            ) : !hasPlatformData ? (
              <EmptyChartState message="No platform revenue data for this range." />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights?.revenueByPlatform}
                      dataKey="revenue"
                      nameKey="platform"
                      innerRadius={52}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {insights?.revenueByPlatform.map((entry, index) => (
                        <Cell
                          key={`${entry.platform}-${entry.revenue}`}
                          fill={
                            CHART_COLORS.platform[
                            index % CHART_COLORS.platform.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value ?? 0)),
                        "Revenue",
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader>
            <CardTitle className="text-base dash-text">Top Brands (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {insightsQuery.isLoading ? (
              <LoadingChartState />
            ) : !hasBrandData ? (
              <EmptyChartState message="No brand revenue data for this range." />
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topBrands}
                    layout="vertical"
                    margin={{ left: 16, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.grid}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                      tickFormatter={(value) => compactCurrency(Number(value))}
                    />
                    <YAxis
                      dataKey="brandName"
                      type="category"
                      width={100}
                      tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value ?? 0)),
                        "Revenue",
                      ]}
                    />
                    <Bar
                      dataKey="revenue"
                      fill={CHART_COLORS.brands}
                      radius={[6, 6, 6, 6]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dash-card border dash-border">
          <CardHeader>
            <CardTitle className="text-base dash-text">Deal Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {insightsQuery.isLoading ? (
              <LoadingChartState />
            ) : !hasPipelineData ? (
              <EmptyChartState message="No deal pipeline activity for this range." />
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0), "Deals"]}
                    />
                    <Funnel
                      data={pipelineData}
                      dataKey="value"
                      nameKey="stage"
                      isAnimationActive
                    >
                      {pipelineData.map((entry, index) => (
                        <Cell
                          key={`${entry.stage}-${entry.value}`}
                          fill={
                            CHART_COLORS.funnel[
                            index % CHART_COLORS.funnel.length
                            ]
                          }
                        />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs dash-text-muted sm:grid-cols-4">
                  {pipelineData.map((item, index) => (
                    <div key={item.stage} className="rounded border p-2">
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS.funnel[
                            index % CHART_COLORS.funnel.length
                            ],
                        }}
                      />
                      {item.stage}: <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
