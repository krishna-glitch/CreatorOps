"use client";

import { BarChart3, ChevronDown, ChevronUp, Download, Minus, TrendingUp } from "lucide-react";
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
  return "border-slate-200 bg-slate-100 text-slate-700";
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
    <Card className={cn("rounded-xl border bg-white shadow-sm", className)}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-slate-600" />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">Quality, readability, engagement, sentiment, and keyword insights.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => expandCollapseAll(false)}
              className="h-8 px-2 text-xs"
            >
              <Minus className="mr-1 h-3.5 w-3.5" />
              Collapse all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => expandCollapseAll(true)}
              className="h-8 px-2 text-xs"
            >
              <TrendingUp className="mr-1 h-3.5 w-3.5" />
              Expand all
            </Button>
            {enablePdfExport ? <ExportPdfButton onExport={handleExportPdf} /> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Section title="1. Quality Score (Overall)" expanded={expanded.quality} onToggle={() => toggle("quality")}>
          <div className={cn("rounded-lg border p-4", qualityTone.bgClass)}>
            <div className="flex items-end gap-3">
              <p className={cn("text-4xl font-bold leading-none", qualityTone.textClass)}>{qualityScore}</p>
              <p className="pb-1 text-sm text-slate-600">/100</p>
              <Badge variant="outline" className={cn("ml-auto", qualityTone.badgeClass)}>
                {qualityTone.label}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Derived from readability, engagement, and sentiment.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
              <div className="rounded border bg-white px-3 py-2">
                Readability: <span className="font-semibold">{metrics.readability.score}</span>
              </div>
              <div className="rounded border bg-white px-3 py-2">
                Engagement: <span className="font-semibold">{metrics.engagement.score}</span>
              </div>
              <div className="rounded border bg-white px-3 py-2">
                Sentiment: <span className="font-semibold">{metrics.sentiment.score}</span>
              </div>
            </div>
          </div>
        </Section>

        <Section title="2. Readability" expanded={expanded.readability} onToggle={() => toggle("readability")}>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="rounded border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Score</p>
              <p className="text-lg font-semibold text-slate-900">{metrics.readability.score}</p>
            </div>
            <div className="rounded border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Reading Level</p>
              <p className="text-lg font-semibold text-slate-900">{metrics.readability.level}</p>
            </div>
            <div className="rounded border bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">US Grade</p>
              <p className="text-lg font-semibold text-slate-900">{metrics.readability.grade}</p>
            </div>
          </div>
          <p className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Tip: {getReadabilityTip(metrics.readability.score)}
          </p>
        </Section>

        <Section title="3. Engagement" expanded={expanded.engagement} onToggle={() => toggle("engagement")}>
          <div className="mb-3">
            <p className="text-2xl font-bold text-slate-900">{metrics.engagement.score}/100</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded border px-3 py-2">
              {metrics.engagement.factors.hasQuestions ? "✓" : "✗"} Has questions
              <span className="ml-2 text-xs text-slate-500">({metrics.engagement.factors.questionCount})</span>
            </div>
            <div className="rounded border px-3 py-2">
              {metrics.engagement.factors.hasCallToAction ? "✓" : "✗"} Has call to action
            </div>
            <div className="rounded border px-3 py-2">
              Emojis: <span className="font-semibold">{metrics.engagement.factors.emojiCount}</span>
            </div>
            <div className="rounded border px-3 py-2">
              Personal pronouns: <span className="font-semibold">{metrics.engagement.factors.personalPronouns}</span>
            </div>
          </div>
          <p className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tip: {getEngagementTip(metrics)}
          </p>
        </Section>

        <Section title="4. Sentiment" expanded={expanded.sentiment} onToggle={() => toggle("sentiment")}>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn(getSentimentBadge(metrics.sentiment.sentiment))}>
              {metrics.sentiment.sentiment.toUpperCase()}
            </Badge>
            <span className="text-sm text-slate-600">Score: {metrics.sentiment.score}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded border bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-700">Top positive words</p>
              <p className="mt-1 text-sm text-emerald-800">
                {sentimentDetails.positive.length > 0 ? sentimentDetails.positive.join(", ") : "None detected"}
              </p>
            </div>
            <div className="rounded border bg-rose-50 px-3 py-2">
              <p className="text-xs text-rose-700">Top negative words</p>
              <p className="mt-1 text-sm text-rose-800">
                {sentimentDetails.negative.length > 0 ? sentimentDetails.negative.join(", ") : "None detected"}
              </p>
            </div>
          </div>
        </Section>

        <Section title="5. Keywords" expanded={expanded.keywords} onToggle={() => toggle("keywords")}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={keywordChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="word" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value) => {
                    const numericValue =
                      typeof value === "number"
                        ? value
                        : Number(Array.isArray(value) ? value[0] : value ?? 0);
                    return [`${numericValue}%`, "Density"];
                  }}
                />
                <Bar dataKey="density" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            {metrics.keywords.slice(0, 10).map((item) => (
              <p key={item.word}>
                {item.word}: {item.count} ({item.percentage}%)
              </p>
            ))}
            {metrics.keywords.length === 0 ? <p>No meaningful keywords yet.</p> : null}
          </div>
          <p className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Tip: {getKeywordTip(metrics.keywords)}
          </p>
        </Section>

        <Section title="6. Quick Stats" expanded={expanded.quickStats} onToggle={() => toggle("quickStats")}>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Words</p>
              <p className="font-semibold">{metrics.basic.words}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Sentences</p>
              <p className="font-semibold">{metrics.basic.sentences}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Avg Sentence Length</p>
              <p className="font-semibold">{metrics.basic.avgSentenceLength}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Characters</p>
              <p className="font-semibold">{metrics.basic.characters}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Emojis</p>
              <p className="font-semibold">{metrics.basic.emojis}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Hashtags</p>
              <p className="font-semibold">{metrics.basic.hashtags}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Mentions</p>
              <p className="font-semibold">{metrics.basic.mentions}</p>
            </div>
            <div className="rounded border px-3 py-2">
              <p className="text-xs text-slate-500">Links</p>
              <p className="font-semibold">{metrics.basic.links}</p>
            </div>
          </div>
        </Section>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Compare with top performers</p>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border bg-white px-3 py-2">
              <p className="text-slate-500">Quality</p>
              <p className="font-semibold text-slate-900">
                {compareLabel(qualityScore, topAverages.quality)}
              </p>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <p className="text-slate-500">Readability</p>
              <p className="font-semibold text-slate-900">
                {compareLabel(metrics.readability.score, topAverages.readability)}
              </p>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <p className="text-slate-500">Engagement</p>
              <p className="font-semibold text-slate-900">
                {compareLabel(metrics.engagement.score, topAverages.engagement)}
              </p>
            </div>
            <div className="rounded border bg-white px-3 py-2">
              <p className="text-slate-500">Sentiment</p>
              <p className="font-semibold text-slate-900">
                {compareLabel(metrics.sentiment.score, topAverages.sentiment, true)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
