"use client";

import { diffLines } from "diff";
import { History, RotateCcw, SplitSquareVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatRelativeTime } from "@/lib/utils";

export type ScriptVersion = {
  version: number;
  content: string;
  saved_at: string | Date;
  word_count: number;
};

type DiffRow = {
  left: string;
  right: string;
  leftType: "add" | "remove" | "same" | "empty";
  rightType: "add" | "remove" | "same" | "empty";
};

type VersionHistoryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: ScriptVersion[];
  currentContent: string;
  onRestore: (version: ScriptVersion) => Promise<void> | void;
  isRestoring?: boolean;
  className?: string;
};

function normalizeSavedAt(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function getPreview(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 100);
}

function getDelta(current: ScriptVersion, older?: ScriptVersion) {
  const prev = older?.word_count ?? 0;
  const delta = current.word_count - prev;
  if (delta > 0) {
    return `+${delta}`;
  }
  if (delta < 0) {
    return `${delta}`;
  }
  return "0";
}

function splitLines(value: string) {
  return value.split("\n").filter((line, index, arr) => {
    if (index !== arr.length - 1) {
      return true;
    }
    return line.length > 0;
  });
}

function buildDiffRows(left: string, right: string): DiffRow[] {
  const parts = diffLines(left, right);
  const rows: DiffRow[] = [];

  for (const part of parts) {
    const lines = splitLines(part.value);

    if (part.added) {
      for (const line of lines) {
        rows.push({
          left: "",
          right: line,
          leftType: "empty",
          rightType: "add",
        });
      }
      continue;
    }

    if (part.removed) {
      for (const line of lines) {
        rows.push({
          left: line,
          right: "",
          leftType: "remove",
          rightType: "empty",
        });
      }
      continue;
    }

    for (const line of lines) {
      rows.push({
        left: line,
        right: line,
        leftType: "same",
        rightType: "same",
      });
    }
  }

  return rows;
}

function diffCellClass(type: DiffRow["leftType"]) {
  if (type === "add") {
    return "bg-emerald-500/15 text-emerald-200";
  }
  if (type === "remove") {
    return "bg-rose-500/15 text-rose-200";
  }
  if (type === "same") {
    return "bg-slate-500/10 text-slate-300";
  }
  return "bg-black/40 text-slate-500";
}

export function VersionHistory({
  open,
  onOpenChange,
  versions,
  currentContent,
  onRestore,
  isRestoring = false,
  className,
}: VersionHistoryProps) {
  const sortedVersions = useMemo(
    () =>
      [...versions].sort(
        (a, b) => normalizeSavedAt(b.saved_at).getTime() - normalizeSavedAt(a.saved_at).getTime(),
      ),
    [versions],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [compareLeftVersion, setCompareLeftVersion] = useState<number | null>(null);
  const [compareRightVersion, setCompareRightVersion] = useState<number | "current">("current");
  const [confirmRestoreVersion, setConfirmRestoreVersion] = useState<ScriptVersion | null>(null);
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);

  const activeVersion = sortedVersions[activeIndex] ?? null;
  const leftVersion = sortedVersions.find((v) => v.version === compareLeftVersion) ?? null;
  const rightVersion =
    compareRightVersion === "current"
      ? null
      : sortedVersions.find((v) => v.version === compareRightVersion) ?? null;

  const diffRows = useMemo(() => {
    if (!leftVersion) {
      return [];
    }
    const rightText = rightVersion ? rightVersion.content : currentContent;
    return buildDiffRows(leftVersion.content, rightText);
  }, [currentContent, leftVersion, rightVersion]);

  useEffect(() => {
    if (!open || sortedVersions.length === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(sortedVersions.length - 1, prev + 1));
        return;
      }

      if (event.key === "Enter" && activeVersion) {
        event.preventDefault();
        setCompareLeftVersion(activeVersion.version);
        setCompareRightVersion("current");
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (activeVersion) {
          setConfirmRestoreVersion(activeVersion);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeVersion, open, sortedVersions.length]);

  useEffect(() => {
    if (!open) {
      setConfirmRestoreVersion(null);
      setIsSubmittingRestore(false);
    }
  }, [open]);

  const newestVersionNumber = sortedVersions[0]?.version ?? 0;
  const nextVersionNumber = newestVersionNumber + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "left-auto right-0 top-0 h-screen w-[min(96vw,76rem)] max-w-[76rem] translate-x-0 translate-y-0 rounded-none border-l border-gray-800 bg-[#0a0e16] p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          className,
        )}
      >
        <div className="grid h-full grid-cols-1 md:grid-cols-[24rem_1fr]">
          <section className="flex h-full flex-col border-b border-r border-white/10 md:border-b-0">
            <DialogHeader className="border-b border-white/10 px-4 py-4">
              <DialogTitle className="flex items-center gap-2 text-white">
                <History className="h-4 w-4" />
                Version History
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                `Alt + ↑/↓` jump versions, `Enter` compare, `Cmd/Ctrl + Shift + R` restore.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {sortedVersions.map((version, index) => {
                const older = sortedVersions[index + 1];
                const selected = version.version === activeVersion?.version;
                return (
                  <div
                    key={version.version}
                    className={cn(
                      "rounded-lg border p-3 transition-all duration-200",
                      selected
                        ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                    )}
                    onClick={() => setActiveIndex(index)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">Version {version.version}</p>
                        <p className="text-xs text-slate-400">
                          {formatRelativeTime(normalizeSavedAt(version.saved_at))}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-300">
                        <p>{version.word_count} words</p>
                        <p
                          className={cn(
                            "font-medium",
                            getDelta(version, older).startsWith("+")
                              ? "text-emerald-300"
                              : getDelta(version, older).startsWith("-")
                                ? "text-rose-300"
                                : "text-slate-400",
                          )}
                        >
                          {getDelta(version, older)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                      {getPreview(version.content)}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/20 bg-transparent text-slate-200 hover:bg-white/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCompareLeftVersion(version.version);
                          setCompareRightVersion("current");
                        }}
                      >
                        <SplitSquareVertical className="mr-1 h-3.5 w-3.5" />
                        Compare
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 bg-cyan-500 text-black hover:bg-cyan-400"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmRestoreVersion(version);
                        }}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
              <p className="text-sm font-medium text-white">Compare View</p>
              <select
                className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-xs text-slate-100"
                value={compareLeftVersion ?? ""}
                onChange={(event) =>
                  setCompareLeftVersion(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Left version</option>
                {sortedVersions.map((version) => (
                  <option key={`left-${version.version}`} value={version.version}>
                    Version {version.version}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-xs text-slate-100"
                value={compareRightVersion}
                onChange={(event) =>
                  setCompareRightVersion(
                    event.target.value === "current" ? "current" : Number(event.target.value),
                  )
                }
              >
                <option value="current">Current Draft</option>
                {sortedVersions.map((version) => (
                  <option key={`right-${version.version}`} value={version.version}>
                    Version {version.version}
                  </option>
                ))}
              </select>
            </div>

            {!leftVersion ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
                Pick a version and press Compare to see side-by-side diff.
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-hidden bg-white/10">
                <div className="flex min-h-0 flex-col bg-[#0d1118]">
                  <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-slate-300">
                    Left: Version {leftVersion.version}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {diffRows.map((row, index) => (
                      <div
                        key={`l-${index}`}
                        className={cn(
                          "border-b border-white/5 px-3 py-1 font-mono text-xs",
                          diffCellClass(row.leftType),
                        )}
                      >
                        {row.left || " "}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col bg-[#0d1118]">
                  <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-slate-300">
                    Right:{" "}
                    {rightVersion ? `Version ${rightVersion.version}` : "Current Draft"}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {diffRows.map((row, index) => (
                      <div
                        key={`r-${index}`}
                        className={cn(
                          "border-b border-white/5 px-3 py-1 font-mono text-xs",
                          diffCellClass(row.rightType),
                        )}
                      >
                        {row.right || " "}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {confirmRestoreVersion ? (
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 backdrop-blur">
            <p className="text-sm text-amber-100">
              Restore version {confirmRestoreVersion.version}? Current changes will be saved as
              version {nextVersionNumber}.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10"
                onClick={() => setConfirmRestoreVersion(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-400 text-black hover:bg-amber-300"
                disabled={isRestoring || isSubmittingRestore}
                onClick={async () => {
                  try {
                    setIsSubmittingRestore(true);
                    await onRestore(confirmRestoreVersion);
                    setConfirmRestoreVersion(null);
                  } finally {
                    setIsSubmittingRestore(false);
                  }
                }}
              >
                Confirm Restore
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

