"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  estimateDuration,
  speakingRates,
  targetDurations,
  type DurationEstimate,
} from "@/src/lib/utils/scriptAnalyzer";

type Platform = keyof typeof speakingRates;
type IndicatorKind = "perfect" | "warning" | "error";

type ScriptStatsProps = {
  text: string;
  className?: string;
};

const PLATFORM_STORAGE_KEY = "creatorops.scriptstats.platform";
const CONTENT_TYPE_STORAGE_KEY = "creatorops.scriptstats.contentType";

const platformLabel: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const contentTypeLabel: Partial<Record<string, string>> = {
  reel: "Reel",
  story: "Story",
  post: "Post",
  short: "Short",
  video: "Video",
  long: "Long-form",
};

const platformOptions = Object.keys(speakingRates) as Platform[];

function getContentTypeOptions(platform: Platform): string[] {
  return Object.keys(speakingRates[platform]);
}

function isPlatform(value: string): value is Platform {
  return platformOptions.includes(value as Platform);
}

function isContentTypeForPlatform(platform: Platform, contentType: string) {
  return getContentTypeOptions(platform).includes(contentType);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getTarget(platform: Platform, contentType: string) {
  const targets = targetDurations[platform] as Record<
    string,
    { min: number; ideal: number; max: number }
  >;
  return targets?.[contentType] ?? null;
}

function getIndicator(
  estimate: DurationEstimate,
  platform: Platform,
  contentType: string,
): { kind: IndicatorKind; label: string } {
  const target = getTarget(platform, contentType);
  if (!target) {
    return {
      kind: estimate.status === "perfect" ? "perfect" : "warning",
      label: estimate.status === "perfect" ? "Perfect" : "Warning",
    };
  }

  if (estimate.estimatedSeconds < target.min) {
    return { kind: "error", label: "Too short" };
  }

  if (estimate.estimatedSeconds > target.max) {
    return { kind: "error", label: "Too long" };
  }

  const idealTolerance = Math.max(2, Math.round(target.ideal * 0.12));
  if (Math.abs(estimate.estimatedSeconds - target.ideal) <= idealTolerance) {
    return { kind: "perfect", label: "Perfect" };
  }

  return { kind: "warning", label: "Warning" };
}

function getIndicatorStyles(kind: IndicatorKind) {
  if (kind === "perfect") {
    return {
      badgeClass: "border-emerald-300 bg-emerald-100 text-emerald-700",
      barClass: "bg-emerald-500",
      Icon: CheckCircle2,
      iconText: "✓",
    };
  }

  if (kind === "warning") {
    return {
      badgeClass: "border-amber-300 bg-amber-100 text-amber-700",
      barClass: "bg-amber-500",
      Icon: AlertTriangle,
      iconText: "⚠",
    };
  }

  return {
    badgeClass: "border-rose-300 bg-rose-100 text-rose-700",
    barClass: "bg-rose-500",
    Icon: XCircle,
    iconText: "❌",
  };
}

export function ScriptStats({ text, className }: ScriptStatsProps) {
  const defaultPlatform = platformOptions[0] ?? "instagram";
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [contentType, setContentType] = useState(
    getContentTypeOptions(defaultPlatform)[0] ?? "reel",
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [estimate, setEstimate] = useState<DurationEstimate>(() =>
    estimateDuration(text, defaultPlatform, contentType),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedPlatform = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    const savedContentType = window.localStorage.getItem(CONTENT_TYPE_STORAGE_KEY);

    if (savedPlatform && isPlatform(savedPlatform)) {
      const nextContent = isContentTypeForPlatform(savedPlatform, savedContentType ?? "")
        ? (savedContentType as string)
        : getContentTypeOptions(savedPlatform)[0];
      setPlatform(savedPlatform);
      if (nextContent) {
        setContentType(nextContent);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
  }, [platform]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CONTENT_TYPE_STORAGE_KEY, contentType);
  }, [contentType]);

  useEffect(() => {
    setIsCalculating(true);
    const timeoutId = window.setTimeout(() => {
      setEstimate(estimateDuration(text, platform, contentType));
      setIsCalculating(false);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [text, platform, contentType]);

  const contentTypeOptions = useMemo(() => getContentTypeOptions(platform), [platform]);
  const target = getTarget(platform, contentType);
  const indicator = getIndicator(estimate, platform, contentType);
  const indicatorStyles = getIndicatorStyles(indicator.kind);

  const progressPercent = target
    ? Math.min((estimate.estimatedSeconds / Math.max(target.ideal, 1)) * 100, 100)
    : 0;

  const rangeHint = target
    ? `${target.min}s - ${target.max}s (ideal ${target.ideal}s)`
    : "No duration target for this content type.";

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-card-foreground", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Script Stats</div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? "Less" : "Details"}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Platform</p>
          <Select
            value={platform}
            onValueChange={(value) => {
              if (!isPlatform(value)) return;
              setPlatform(value);

              const nextOptions = getContentTypeOptions(value);
              if (!nextOptions.includes(contentType)) {
                setContentType(nextOptions[0] ?? "video");
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {platformOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {platformLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Type</p>
          <Select value={contentType} onValueChange={setContentType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contentTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {contentTypeLabel[option] ?? option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-md border bg-background px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Words</p>
          <p className="text-sm font-semibold">{estimate.wordCount}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Chars</p>
          <p className="text-sm font-semibold">{estimate.characterCount}</p>
        </div>
        <div className="rounded-md border bg-background px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Duration</p>
          <p className="text-sm font-semibold">{formatDuration(estimate.estimatedSeconds)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant="outline" className={cn("text-xs", indicatorStyles.badgeClass)}>
          <indicatorStyles.Icon className="mr-1 h-3.5 w-3.5" />
          {indicatorStyles.iconText} {indicator.label}
        </Badge>
        {isCalculating ? (
          <p className="text-xs text-muted-foreground">Calculating...</p>
        ) : (
          <p className="text-xs text-muted-foreground">{rangeHint}</p>
        )}
      </div>

      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", indicatorStyles.barClass)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{estimate.suggestion}</p>

      {isExpanded ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
          <div className="rounded-md bg-muted/40 px-2 py-2">
            <p className="text-[11px] text-muted-foreground">Current Platform</p>
            <p className="text-xs font-medium">
              {platformLabel[platform]} {contentTypeLabel[contentType] ?? contentType}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-2">
            <p className="text-[11px] text-muted-foreground">Target Window</p>
            <p className="text-xs font-medium">{rangeHint}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

