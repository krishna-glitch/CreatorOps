"use client";

import { FileText, Plus, Search, Share2, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ScriptEditor = dynamic(
  () => import("@/src/components/media/ScriptEditor").then((mod) => mod.ScriptEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border dash-border p-6 text-sm dash-text-muted">
        Loading editor...
      </div>
    ),
  },
);

const NOOP_UPLOAD_ENDPOINT = "/api/script-drafts/upload";
const FILES_STORAGE_KEY = "creatorops.scriptlab.files.v1";
const SCRIPTLAB_BANNER_DISMISSED_KEY = "creatorops.scriptlab.banner.dismissed.v1";

type ScriptFile = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

function createScriptFile(title = "Untitled Video Script"): ScriptFile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
  };
}

function getDeliverableId(fileId: string) {
  return `script-lab-${fileId}`;
}

function toFileBaseName(title: string) {
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "video-script";
}

function formatUpdatedAt(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function htmlToPlainText(html: string) {
  if (typeof window === "undefined") {
    return "";
  }
  const container = window.document.createElement("div");
  container.innerHTML = html;
  return container.textContent?.trim() ?? "";
}

export default function ScriptLabPage() {
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(FILES_STORAGE_KEY);
      if (!raw) {
        const starter = createScriptFile("Intro Video Script");
        setFiles([starter]);
        setSelectedFileId(starter.id);
        return;
      }

      const parsed = JSON.parse(raw) as ScriptFile[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const starter = createScriptFile("Intro Video Script");
        setFiles([starter]);
        setSelectedFileId(starter.id);
        return;
      }

      const sorted = [...parsed].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      setFiles(sorted);
      setSelectedFileId(sorted[0]?.id ?? null);
    } catch {
      const starter = createScriptFile("Intro Video Script");
      setFiles([starter]);
      setSelectedFileId(starter.id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isDismissed =
      window.localStorage.getItem(SCRIPTLAB_BANNER_DISMISSED_KEY) === "1";
    setShowInfoBanner(!isDismissed);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (files.length === 0) return;
    window.localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(null);
      return;
    }

    const stillExists = selectedFileId
      ? files.some((file) => file.id === selectedFileId)
      : false;
    if (!stillExists) {
      setSelectedFileId(files[0]?.id ?? null);
    }
  }, [files, selectedFileId]);

  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null;

  const visibleFiles = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.title.toLowerCase().includes(needle));
  }, [files, searchTerm]);

  const createFile = () => {
    const newFile = createScriptFile(`Video Script ${files.length + 1}`);
    setFiles((current) => [newFile, ...current]);
    setSelectedFileId(newFile.id);
  };

  const updateSelectedTitle = (nextTitle: string) => {
    if (!selectedFileId) return;
    setFiles((current) =>
      current.map((file) =>
        file.id === selectedFileId
          ? {
              ...file,
              title: nextTitle,
              updatedAt: new Date().toISOString(),
            }
          : file,
      ),
    );
  };

  const touchSelectedFile = () => {
    if (!selectedFileId) return;
    setFiles((current) =>
      [...current]
        .map((file) =>
          file.id === selectedFileId
            ? { ...file, updatedAt: new Date().toISOString() }
            : file,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  };

  const deleteSelectedFile = () => {
    if (!selectedFileId || typeof window === "undefined") return;

    const confirmed = window.confirm(
      "Delete this script file? This removes local draft history for it.",
    );
    if (!confirmed) return;

    const deliverableId = getDeliverableId(selectedFileId);
    window.localStorage.removeItem(`creatorops.script.draft.${deliverableId}`);
    window.localStorage.removeItem(`creatorops.script.versions.${deliverableId}`);

    setFiles((current) => current.filter((file) => file.id !== selectedFileId));
  };

  const shareSelectedFile = async () => {
    if (!selectedFile || typeof window === "undefined") return;

    const deliverableId = getDeliverableId(selectedFile.id);
    const rawDraft =
      window.localStorage.getItem(`creatorops.script.draft.${deliverableId}`) ??
      "";
    const scriptText = htmlToPlainText(rawDraft);
    const shareTitle = selectedFile.title.trim() || "Video Script";
    const sharePayload = {
      title: shareTitle,
      text:
        scriptText.length > 0
          ? `${shareTitle}\n\n${scriptText}`
          : `${shareTitle}\n\n(No script content yet)`,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }

      await navigator.clipboard.writeText(sharePayload.text);
      toast.success("Script copied to clipboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Could not share this script right now.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
      {showInfoBanner ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <p>
            Script files are organized locally like a notebook. They survive
            refresh in this browser.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
            onClick={() => {
              setShowInfoBanner(false);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(
                  SCRIPTLAB_BANNER_DISMISSED_KEY,
                  "1",
                );
              }
            }}
            aria-label="Dismiss script lab banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="grid min-h-[78vh] grid-cols-1 gap-4 md:grid-cols-[330px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-2 dash-border shadow-md">
          <CardHeader className="space-y-4 border-b dash-border bg-gradient-to-b from-slate-50 to-white pb-4 dash-border dark:from-slate-950 dark:to-slate-950">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Script Library</CardTitle>
              <Button type="button" size="sm" onClick={createFile}>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search scripts..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{files.length} files</Badge>
              <p className="text-xs text-muted-foreground">
                {searchTerm.trim() ? `${visibleFiles.length} shown` : "All visible"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="max-h-[calc(78vh-160px)] space-y-2 overflow-auto p-3">
            {visibleFiles.length === 0 ? (
              <p className="rounded-lg border border-dashed dash-border p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No matching scripts.
              </p>
            ) : (
              visibleFiles.map((file) => {
                const active = file.id === selectedFileId;

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-slate-900 dash-bg-panel text-white shadow-sm dash-border dash-bg-card dark:text-slate-900"
                        : "border dash-border dash-bg-panel"
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-medium">{file.title}</p>
                    <p
                      className={`mt-1 text-xs ${
                        active ? "text-slate-200 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Updated {formatUpdatedAt(file.updatedAt)}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-2 dash-border shadow-md">
          <CardHeader className="border-b dash-border bg-gradient-to-r from-slate-50 to-white pb-4 dash-border dark:from-slate-950 dark:to-slate-950">
            {selectedFile ? (
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <Input
                  value={selectedFile.title}
                  onChange={(event) => updateSelectedTitle(event.target.value)}
                  placeholder="Video script title"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={shareSelectedFile}
                  className="border-slate-300 dark:border-slate-700"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={deleteSelectedFile}
                  className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-700 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ) : (
              <CardTitle className="text-base">Script Editor</CardTitle>
            )}
          </CardHeader>

          <CardContent className="p-3 md:p-4">
            {selectedFile ? (
              <div className="rounded-xl border dash-border">
                <ScriptEditor
                  key={selectedFile.id}
                  deliverableId={getDeliverableId(selectedFile.id)}
                  fileBaseName={toFileBaseName(selectedFile.title)}
                  autoSaveIntervalMs={20_000}
                  getSignedUrl={async ({ fileName }) => ({
                    signedUrl: NOOP_UPLOAD_ENDPOINT,
                    path: `local/script-lab/${selectedFile.id}/${fileName}`,
                    method: "POST",
                  })}
                  saveMetadata={async () => {}}
                  onSaved={touchSelectedFile}
                />
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed dash-border text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Create a script file to start writing.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
