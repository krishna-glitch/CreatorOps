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
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 rounded-xl border dash-border dash-bg-card p-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Words</p>
          <p className="text-2xl font-bold text-slate-900">{estimate.wordCount}</p>
        </div>
        <div className="space-y-1 rounded-xl border dash-border dash-bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Duration</p>
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", indicatorStyles.badgeClass)}>
              {indicatorStyles.iconText} {indicator.label}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatDuration(estimate.estimatedSeconds)}</p>
        </div>
      </div>

      <div className="rounded-xl border dash-border dash-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-900">Target</span>
            <span className="text-xs text-slate-500">{rangeHint}</span>
          </div>

          <div className="flex items-center gap-2">
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
              <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent p-0 text-xs font-medium text-slate-500 shadow-none hover:text-slate-900 focus:ring-0">
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
            <span className="text-slate-300">/</span>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent p-0 text-xs font-medium text-slate-500 shadow-none hover:text-slate-900 focus:ring-0">
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

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full dash-bg-card">
            <div
              className={cn("h-full transition-all duration-500 ease-out", indicatorStyles.barClass)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>0s</span>
            <span>{target ? `${target.max}s` : "No limit"}</span>
          </div>
        </div>

        {estimate.suggestion && (
          <div className="mt-4 rounded-lg dash-bg-card p-2 text-xs leading-relaxed text-slate-600">
            {estimate.suggestion}
          </div>
        )}
      </div>
    </div>
  );
}


