"use client";

import { FileText, Plus, Search, Share2, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";

const ScriptEditor = dynamic(
  () =>
    import("@/src/components/media/ScriptEditor").then(
      (mod) => mod.ScriptEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border dash-border p-6 text-sm dash-text-muted">
        Loading editor...
      </div>
    ),
  },
);

const SCRIPTLAB_BANNER_DISMISSED_KEY =
  "creatorops.scriptlab.banner.dismissed.v1";
const SELECTED_FILE_STORAGE_KEY = "creatorops.scriptlab.selected-file.v1";

type ScriptFile = {
  id: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function createDefaultScriptTitle() {
  return `Untitled Script ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
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

function formatUpdatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function markdownToInitialHtml(markdown: string) {
  const escaped = markdown
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const blocks = escaped
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`);

  return blocks.length > 0 ? blocks.join("") : "<p></p>";
}

export default function ScriptLabPage() {
  const utils = trpc.useUtils();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [titleDraft, setTitleDraft] = useState("");

  const filesQuery = trpc.scriptLab.list.useQuery(undefined, {
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const createFileMutation = trpc.scriptLab.create.useMutation({
    onSuccess: async (created) => {
      await utils.scriptLab.list.invalidate();
      setSelectedFileId(created.id);
      setTitleDraft(created.title);
    },
    onError: (error) => {
      toast.error(error.message || "Could not create script file.");
    },
  });

  const updateTitleMutation = trpc.scriptLab.updateTitle.useMutation({
    onSuccess: async () => {
      await utils.scriptLab.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Could not rename script file.");
    },
  });

  const deleteFileMutation = trpc.scriptLab.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.scriptLab.list.invalidate(),
        utils.scriptLab.getById.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Could not delete script file.");
    },
  });

  const files: ScriptFile[] = filesQuery.data?.items ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isDismissed =
      window.localStorage.getItem(SCRIPTLAB_BANNER_DISMISSED_KEY) === "1";
    setShowInfoBanner(!isDismissed);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (files.length === 0) {
      setSelectedFileId(null);
      return;
    }

    const rememberedSelection = window.localStorage.getItem(
      SELECTED_FILE_STORAGE_KEY,
    );

    setSelectedFileId((current) => {
      if (current && files.some((item) => item.id === current)) {
        return current;
      }
      if (
        rememberedSelection &&
        files.some((item) => item.id === rememberedSelection)
      ) {
        return rememberedSelection;
      }
      return files[0]?.id ?? null;
    });
  }, [files]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!selectedFileId) {
      window.localStorage.removeItem(SELECTED_FILE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_FILE_STORAGE_KEY, selectedFileId);
  }, [selectedFileId]);

  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null;

  useEffect(() => {
    setTitleDraft(selectedFile?.title ?? "");
  }, [selectedFile?.title]);

  const fileContentQuery = trpc.scriptLab.getById.useQuery(
    { id: selectedFileId ?? "00000000-0000-0000-0000-000000000000" },
    {
      enabled: Boolean(selectedFileId),
      staleTime: 10_000,
    },
  );

  const visibleFiles = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.title.toLowerCase().includes(needle));
  }, [files, searchTerm]);

  const createFile = () => {
    const id = crypto.randomUUID();
    void createFileMutation.mutate({ id, title: createDefaultScriptTitle() });
  };

  const saveTitle = async () => {
    if (!selectedFile) return;

    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === selectedFile.title) {
      setTitleDraft(selectedFile.title);
      return;
    }

    await updateTitleMutation.mutateAsync({
      id: selectedFile.id,
      title: nextTitle,
    });
  };

  const deleteSelectedFile = async () => {
    if (!selectedFileId || typeof window === "undefined") return;

    const confirmed = window.confirm(
      "Delete this script file? This removes script content and local draft history.",
    );
    if (!confirmed) return;

    const deliverableId = getDeliverableId(selectedFileId);
    window.localStorage.removeItem(`creatorops.script.draft.${deliverableId}`);
    window.localStorage.removeItem(
      `creatorops.script.versions.${deliverableId}`,
    );

    await deleteFileMutation.mutateAsync({ id: selectedFileId });
  };

  const shareSelectedFile = async () => {
    if (!selectedFile) return;

    const scriptText = (fileContentQuery.data?.contentMarkdown ?? "").trim();
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
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p>
            Script files are synced to your account and available across
            devices.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
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
              <Button
                type="button"
                size="sm"
                onClick={createFile}
                disabled={createFileMutation.isPending}
              >
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
                {searchTerm.trim() ? `${visibleFiles.length} shown` : "Synced"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="max-h-[calc(78vh-160px)] space-y-2 overflow-auto p-3">
            {filesQuery.isLoading ? (
              <p className="rounded-lg border border-dashed dash-border p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Loading scripts...
              </p>
            ) : visibleFiles.length === 0 ? (
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
                    <p className="line-clamp-1 text-sm font-medium">
                      {file.title}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        active
                          ? "text-slate-200 dark:text-slate-600"
                          : "text-slate-500 dark:text-slate-400"
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
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => {
                    void saveTitle();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveTitle();
                    }
                  }}
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
                  onClick={() => {
                    void deleteSelectedFile();
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-700 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
                  disabled={deleteFileMutation.isPending}
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
                  initialHtml={markdownToInitialHtml(
                    fileContentQuery.data?.contentMarkdown ?? "",
                  )}
                  autoSaveIntervalMs={20_000}
                  getSignedUrl={async ({ fileName }) => ({
                    signedUrl: `/api/script-drafts/upload?fileId=${selectedFile.id}&fileName=${encodeURIComponent(fileName)}`,
                    path: `script-lab/${selectedFile.id}/${fileName}`,
                    method: "PUT",
                  })}
                  saveMetadata={async () => {
                    await Promise.all([
                      utils.scriptLab.list.invalidate(),
                      utils.scriptLab.getById.invalidate({
                        id: selectedFile.id,
                      }),
                    ]);
                  }}
                  onSaved={() => {
                    void Promise.all([
                      utils.scriptLab.list.invalidate(),
                      utils.scriptLab.getById.invalidate({
                        id: selectedFile.id,
                      }),
                    ]);
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed dash-border text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Create your first script file to start writing.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
