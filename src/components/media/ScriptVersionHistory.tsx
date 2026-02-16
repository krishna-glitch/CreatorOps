"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

type ScriptVersion = {
  version: number;
  content: string;
  saved_at: string;
  word_count: number;
};

type DiffLine = {
  type: "context" | "add" | "remove";
  line: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getWordDeltaLabel(current: ScriptVersion, older?: ScriptVersion) {
  const delta = current.word_count - (older?.word_count ?? 0);
  if (delta === 0) {
    return "0 words";
  }
  if (delta > 0) {
    return `+${delta} words`;
  }
  return `${delta} words`;
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const rows = oldLines.length;
  const cols = newLines.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => 0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      if (oldLines[i] === newLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "context", line: oldLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ type: "remove", line: oldLines[i] });
      i += 1;
      continue;
    }

    result.push({ type: "add", line: newLines[j] });
    j += 1;
  }

  while (i < rows) {
    result.push({ type: "remove", line: oldLines[i] });
    i += 1;
  }

  while (j < cols) {
    result.push({ type: "add", line: newLines[j] });
    j += 1;
  }

  return result;
}

type ScriptVersionHistoryProps = {
  scriptId: string;
  currentContent: string;
  onRestore: (content: string) => void;
};

export function ScriptVersionHistory({
  scriptId,
  currentContent,
  onRestore,
}: ScriptVersionHistoryProps) {
  const utils = trpc.useUtils();
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  const versionsQuery = trpc.mediaAssets.getScriptVersions.useQuery(
    { scriptId },
    {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  );

  const restoreMutation = trpc.mediaAssets.restoreScriptVersion.useMutation({
    onSuccess: (restored) => {
      onRestore(restored.content);
      void utils.mediaAssets.getScriptVersions.invalidate({ scriptId });
    },
  });

  const versions = versionsQuery.data?.versionHistory ?? [];

  const fromVersion = useMemo(
    () => versions.find((version) => version.version === compareFrom) ?? null,
    [compareFrom, versions],
  );

  const toVersion = useMemo(() => {
    if (compareTo === -1) {
      return {
        version: -1,
        content: currentContent,
        saved_at: new Date().toISOString(),
        word_count: currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0,
      } satisfies ScriptVersion;
    }

    return versions.find((version) => version.version === compareTo) ?? null;
  }, [compareTo, currentContent, versions]);

  const diffLines = useMemo(() => {
    if (!fromVersion || !toVersion) {
      return [];
    }
    return computeDiff(fromVersion.content, toVersion.content);
  }, [fromVersion, toVersion]);

  if (versionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading version history...</p>;
  }

  if (versionsQuery.error) {
    return (
      <p className="text-sm text-red-600">
        Could not load version history: {versionsQuery.error.message}
      </p>
    );
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No saved versions yet.</p>;
  }

  return (
    <section className="space-y-4 rounded-lg border dash-border p-4 dash-border">
      <h3 className="text-sm font-medium">Version History</h3>

      <div className="space-y-2">
        {versions.map((version, index) => (
          <div
            key={version.version}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border dash-border dash-bg-card p-3 text-sm dark:border-gray-900 dash-bg-panel"
          >
            <div className="space-y-0.5">
              <p className="font-medium">v{version.version}</p>
              <p className="text-xs text-muted-foreground">
                Saved at {formatTime(version.saved_at)} • {version.word_count} words (
                {getWordDeltaLabel(version, versions[index + 1])})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCompareFrom(version.version);
                  setCompareTo(-1);
                }}
              >
                Compare to Current
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={restoreMutation.isPending}
                onClick={() =>
                  restoreMutation.mutate({
                    scriptId,
                    version: version.version,
                  })
                }
              >
                Restore
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-md border dash-border dash-bg-card p-3 dark:border-gray-900 dash-bg-panel">
        <p className="text-xs font-medium text-muted-foreground">Compare Versions</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border dash-border dash-bg-card px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
            value={compareFrom ?? ""}
            onChange={(event) =>
              setCompareFrom(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">From version</option>
            {versions.map((version) => (
              <option key={`from-${version.version}`} value={version.version}>
                v{version.version}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border dash-border dash-bg-card px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
            value={compareTo ?? ""}
            onChange={(event) =>
              setCompareTo(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">To version</option>
            <option value={-1}>Current editor</option>
            {versions.map((version) => (
              <option key={`to-${version.version}`} value={version.version}>
                v{version.version}
              </option>
            ))}
          </select>
        </div>

        {fromVersion && toVersion ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-black p-3 text-xs text-gray-100">
            {diffLines.map((line, index) => {
              const prefix =
                line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
              const className =
                line.type === "add"
                  ? "text-green-300"
                  : line.type === "remove"
                    ? "text-red-300"
                    : "text-gray-300";
              return (
                <div key={`${line.type}-${index}`} className={className}>
                  {prefix}
                  {line.line}
                </div>
              );
            })}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">
            Choose two versions (or compare a version to current editor content).
          </p>
        )}
      </div>
    </section>
  );
}

