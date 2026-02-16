"use client";

import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Minus,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  analyzeScript,
  analyzeSentiment,
  type ScriptMetrics,
  type SentimentResult,
} from "@/src/lib/utils/scriptMetrics";

type SectionKey = "quality" | "readability" | "engagement" | "sentiment" | "keywords" | "quickStats";

type TopPerformerAverages = {
  quality: number;
  readability: number;
  engagement: number;
  sentiment: number;
};

type ScriptAnalyticsProps = {
  text: string;
  className?: string;
  title?: string;
  defaultExpanded?: boolean;
  debounceMs?: number;
  enablePdfExport?: boolean;
  topPerformerAverages?: Partial<TopPerformerAverages>;
};

const DEFAULT_TOP_PERFORMER_AVGS: TopPerformerAverages = {
  quality: 78,
  readability: 74,
  engagement: 69,
  sentiment: 0.22,
};

function getScoreTone(score: number): {
  textClass: string;
  bgClass: string;
  badgeClass: string;
  label: string;
} {
  if (score <= 40) {
    return {
      textClass: "text-rose-700",
      bgClass: "bg-rose-50",
      badgeClass: "border-rose-200 bg-rose-100 text-rose-700",
      label: "Needs work",
    };
  }

  if (score <= 70) {
    return {
      textClass: "text-amber-700",
      bgClass: "bg-amber-50",
      badgeClass: "border-amber-200 bg-amber-100 text-amber-700",
      label: "Fair",
    };
  }

  return {
    textClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
    badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-700",
    label: "Strong",
  };
}

function getSentimentBadge(sentiment: SentimentResult["sentiment"]) {
  if (sentiment === "positive") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (sentiment === "negative") {
    return "border-rose-200 bg-rose-100 text-rose-700";
  }
  return "dash-border dash-bg-card text-slate-700";
}

function normalizeSentimentScore(score: number): number {
  return Math.round((score + 1) * 50);
}

function getQualityScore(metrics: ScriptMetrics): number {
  const readability = metrics.readability.score;
  const engagement = metrics.engagement.score;
  const sentiment = normalizeSentimentScore(metrics.sentiment.score);
  const weighted = readability * 0.4 + engagement * 0.4 + sentiment * 0.2;
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

function getReadabilityTip(score: number): string {
  if (score >= 70) return "Great! Easy for most audiences to understand.";
  if (score >= 50) return "Good baseline. Try shorter sentences to improve clarity.";
  return "Use simpler words and shorter sentences to improve readability.";
}

function getEngagementTip(metrics: ScriptMetrics): string {
  if (!metrics.engagement.factors.hasQuestions) return "Add a question to boost engagement.";
  if (!metrics.engagement.factors.hasCallToAction) return "Add a clear CTA like “comment below” or “check link in bio.”";
  if (metrics.engagement.factors.personalPronouns < 2) return "Use “you/your” more often to make the script feel personal.";
  return "Strong engagement structure. Keep this pattern for future scripts.";
}

function getKeywordTip(keywords: ScriptMetrics["keywords"]): string {
  if (keywords.length === 0) return "Add specific topical words to strengthen relevance.";
  const top = keywords[0];
  if (top && top.percentage >= 8) {
    return `Using "${top.word}" ${top.count} times might be too much.`;
  }
  return "Keyword spread looks balanced.";
}

function getSentimentWordBreakdown(text: string) {
  const details = analyzeSentiment(text);
  return {
    positive: details.positiveWords.slice(0, 5),
    negative: details.negativeWords.slice(0, 5),
  };
}

function compareLabel(current: number, average: number, isSentiment = false): string {
  const rawDelta = current - average;
  const delta = isSentiment ? Number(rawDelta.toFixed(2)) : Math.round(rawDelta);
  if (delta === 0) return "On par";
  if (delta > 0) return `+${delta} vs top avg`;
  return `${delta} vs top avg`;
}

function ExportPdfButton({ onExport }: { onExport: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-1.5">
      <Download className="h-4 w-4" />
      Export PDF
    </Button>
  );
}

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {expanded ? <div className="border-t px-4 py-4">{children}</div> : null}
    </div>
  );
}

export function ScriptAnalytics({
  text,
  className,
  title = "Script Analytics",
  defaultExpanded = true,
  debounceMs = 300,
  enablePdfExport = true,
  topPerformerAverages,
}: ScriptAnalyticsProps) {
  const [metrics, setMetrics] = useState<ScriptMetrics>(() => analyzeScript(text));
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    quality: defaultExpanded,
    readability: defaultExpanded,
    engagement: defaultExpanded,
    sentiment: defaultExpanded,
    keywords: defaultExpanded,
    quickStats: defaultExpanded,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMetrics(analyzeScript(text));
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [text, debounceMs]);

  const qualityScore = useMemo(() => getQualityScore(metrics), [metrics]);
  const qualityTone = getScoreTone(qualityScore);
  const sentimentDetails = useMemo(() => getSentimentWordBreakdown(text), [text]);
  const topAverages = { ...DEFAULT_TOP_PERFORMER_AVGS, ...topPerformerAverages };

  const keywordChartData = metrics.keywords.slice(0, 10).map((item) => ({
    word: item.word,
    density: item.percentage,
    count: item.count,
  }));

  function toggle(section: SectionKey) {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function expandCollapseAll(nextExpanded: boolean) {
    setExpanded({
      quality: nextExpanded,
      readability: nextExpanded,
      engagement: nextExpanded,
      sentiment: nextExpanded,
      keywords: nextExpanded,
      quickStats: nextExpanded,
    });
  }

  function handleExportPdf() {
    const popup = window.open("", "_blank", "width=960,height=800");
    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>Script Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 12px; }
            h2 { margin-top: 20px; margin-bottom: 8px; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Script Analytics Report</h1>
          <p><strong>Quality Score:</strong> ${qualityScore}/100</p>
          <h2>Readability</h2>
          <p>Score: ${metrics.readability.score}</p>
          <p>Level: ${metrics.readability.level}</p>
          <p>Grade: ${metrics.readability.grade}</p>
          <h2>Engagement</h2>
          <p>Score: ${metrics.engagement.score}/100</p>
          <h2>Sentiment</h2>
          <p>Sentiment: ${metrics.sentiment.sentiment}</p>
          <p>Score: ${metrics.sentiment.score}</p>
          <h2>Quick Stats</h2>
          <p>Words: ${metrics.basic.words}</p>
          <p>Sentences: ${metrics.basic.sentences}</p>
          <p>Average Sentence Length: ${metrics.basic.avgSentenceLength}</p>
          <p>Emojis: ${metrics.basic.emojis}</p>
          <p>Hashtags: ${metrics.basic.hashtags}</p>
          <p>Mentions: ${metrics.basic.mentions}</p>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-xl border dash-border dash-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border dash-border dash-bg-card text-slate-500">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-[10px] text-slate-500">AI-powered content analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => expandCollapseAll(false)}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              title="Collapse all"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => expandCollapseAll(true)}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              title="Expand all"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            {enablePdfExport && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleExportPdf}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                title="Export PDF"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Section title="Quality Score" expanded={expanded.quality} onToggle={() => toggle("quality")}>
            <div className={cn("rounded-lg border p-4 transition-colors", qualityTone.bgClass, qualityTone.textClass.replace("text-", "border-").replace("700", "200"))}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Overall Score</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">{qualityScore}</span>
                    <span className="text-sm opacity-60">/100</span>
                  </div>
                </div>
                <Badge variant="outline" className={cn("mb-1", qualityTone.badgeClass)}>
                  {qualityTone.label}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md dash-bg-card p-2 text-center backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Readability</p>
                  <p className="text-lg font-bold">{metrics.readability.score}</p>
                </div>
                <div className="rounded-md dash-bg-card p-2 text-center backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Engagement</p>
                  <p className="text-lg font-bold">{metrics.engagement.score}</p>
                </div>
                <div className="rounded-md dash-bg-card p-2 text-center backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Sentiment</p>
                  <p className="text-lg font-bold">{metrics.sentiment.score}</p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Readability" expanded={expanded.readability} onToggle={() => toggle("readability")}>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-100 dash-bg-card p-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Grade</p>
                  <p className="font-semibold text-slate-900">{metrics.readability.grade}</p>
                </div>
                <div className="rounded-lg border border-slate-100 dash-bg-card p-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Level</p>
                  <p className="font-semibold text-slate-900">{metrics.readability.level}</p>
                </div>
                <div className="rounded-lg border border-slate-100 dash-bg-card p-2 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Score</p>
                  <p className="font-semibold text-slate-900">{metrics.readability.score}</p>
                </div>
              </div>
              <div className="rounded-md bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800 border border-emerald-100">
                <span className="font-medium">Tip:</span> {getReadabilityTip(metrics.readability.score)}
              </div>
            </div>
          </Section>

          <Section title="Engagement" expanded={expanded.engagement} onToggle={() => toggle("engagement")}>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 dash-bg-card p-3">
                <span className="text-xs font-medium text-slate-600">Engagement Potential</span>
                <span className="text-lg font-bold text-slate-900">{metrics.engagement.score}/100</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className={cn("flex items-center gap-2 rounded border p-2 text-xs", metrics.engagement.factors.hasQuestions ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "dash-border dash-bg-card text-slate-500")}>
                  {metrics.engagement.factors.hasQuestions ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current" />}
                  <span>Questions ({metrics.engagement.factors.questionCount})</span>
                </div>
                <div className={cn("flex items-center gap-2 rounded border p-2 text-xs", metrics.engagement.factors.hasCallToAction ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "dash-border dash-bg-card text-slate-500")}>
                  {metrics.engagement.factors.hasCallToAction ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current" />}
                  <span>Call to Action</span>
                </div>
                <div className="flex items-center justify-between rounded border dash-border dash-bg-card p-2 text-xs text-slate-600">
                  <span>Emojis</span>
                  <span className="font-semibold">{metrics.engagement.factors.emojiCount}</span>
                </div>
                <div className="flex items-center justify-between rounded border dash-border dash-bg-card p-2 text-xs text-slate-600">
                  <span>"You/Your"</span>
                  <span className="font-semibold">{metrics.engagement.factors.personalPronouns}</span>
                </div>
              </div>

              <div className="rounded-md bg-amber-50/50 px-3 py-2 text-xs text-amber-800 border border-amber-100">
                <span className="font-medium">Tip:</span> {getEngagementTip(metrics)}
              </div>
            </div>
          </Section>

          <Section title="Sentiment Analysis" expanded={expanded.sentiment} onToggle={() => toggle("sentiment")}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={cn(getSentimentBadge(metrics.sentiment.sentiment))}>
                  {metrics.sentiment.sentiment.toUpperCase()}
                </Badge>
                <span className="text-xs font-medium text-slate-500">Intensity: {metrics.sentiment.score}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-emerald-600 font-semibold mb-1">Positives</p>
                  {sentimentDetails.positive.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sentimentDetails.positive.map(w => (
                        <span key={w} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-100">{w}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">None detected</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-rose-600 font-semibold mb-1">Negatives</p>
                  {sentimentDetails.negative.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sentimentDetails.negative.map(w => (
                        <span key={w} className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700 border border-rose-100">{w}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">None detected</p>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Keywords & Topics" expanded={expanded.keywords} onToggle={() => toggle("keywords")}>
            <div className="space-y-3">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={keywordChartData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="word" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    />
                    <Bar dataKey="density" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-md bg-blue-50/50 px-3 py-2 text-xs text-blue-800 border border-blue-100">
                <span className="font-medium">Tip:</span> {getKeywordTip(metrics.keywords)}
              </div>
            </div>
          </Section>

          <Section title="Quick Stats" expanded={expanded.quickStats} onToggle={() => toggle("quickStats")}>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Words", value: metrics.basic.words },
                { label: "Sentences", value: metrics.basic.sentences },
                { label: "Links", value: metrics.basic.links },
                { label: "Mentions", value: metrics.basic.mentions },
                { label: "Hashtags", value: metrics.basic.hashtags },
                { label: "Emojis", value: metrics.basic.emojis },
                { label: "Chars", value: metrics.basic.characters, colSpan: 2 },
              ].map((stat) => (
                <div key={stat.label} className={cn("rounded border border-slate-100 dash-bg-card p-2", stat.colSpan && `col-span-${stat.colSpan}`)}>
                  <p className="text-[10px] text-slate-500 uppercase">{stat.label}</p>
                  <p className="font-semibold text-slate-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
