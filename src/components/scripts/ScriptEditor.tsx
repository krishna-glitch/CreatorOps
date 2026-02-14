"use client";

import CharacterCount from "@tiptap/extension-character-count";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  BarChart3,
  CheckCircle2,
  FileClock,
  History,
  Layers,
  Menu,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import TurndownService from "turndown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CompliancePanel,
  type BrandRules,
  type ComplianceHighlight,
} from "@/src/components/scripts/CompliancePanel";
import { HookBrowser } from "@/src/components/scripts/HookBrowser";
import { ScriptAnalytics } from "@/src/components/scripts/ScriptAnalytics";
import { ScriptStats } from "@/src/components/scripts/ScriptStats";
import { TemplateSelector } from "@/src/components/scripts/TemplateSelector";
import { VersionHistory, type ScriptVersion } from "@/src/components/scripts/VersionHistory";

type SaveMetadataInput = {
  deliverableId: string;
  assetType: "SCRIPT";
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: null;
  dimensions: null;
};

type SaveMode = "manual" | "auto";

type LeftTab = "templates" | "hooks";
type RightTab = "stats" | "compliance" | "analytics";

type MobilePanel = "none" | "left" | "right";

type ScriptEditorProps = {
  deliverableId: string;
  initialHtml?: string;
  fileBaseName?: string;
  autoSaveIntervalMs?: number;
  getSignedUrl: (input: {
    deliverableId: string;
    assetType: "SCRIPT";
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  }) => Promise<{
    signedUrl: string;
    path: string;
    method?: "PUT" | "POST";
    headers?: Record<string, string>;
  }>;
  saveMetadata: (input: SaveMetadataInput) => Promise<void>;
  onSaved?: () => void;
  brandId?: string;
  initialBrandRules?: BrandRules;
  onSaveBrandRules?: (input: { brandId: string; rules: BrandRules }) => Promise<void> | void;
};

const UI_STATE_STORAGE_KEY = "creatorops.scripteditor.ui";

function formatTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "");
}

function uploadWithSignedUrl(input: {
  signedUrl: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  body: Blob;
}) {
  return fetch(input.signedUrl, {
    method: input.method,
    headers: input.headers,
    body: input.body,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function scriptTextToHtml(script: string): string {
  return script
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function hasActiveRules(rules?: BrandRules): boolean {
  if (!rules) return false;
  return Boolean(
    (rules.required_phrases?.length ?? 0) > 0 ||
      (rules.forbidden_words?.length ?? 0) > 0 ||
      (rules.required_hashtags?.length ?? 0) > 0 ||
      rules.must_tag_brand ||
      rules.min_word_count ||
      rules.max_word_count ||
      rules.max_hashtags,
  );
}

function countWordsFromText(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function getVersionsStorageKey(deliverableId: string): string {
  return `creatorops.script.versions.${deliverableId}`;
}

function EditorTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className={cn("gap-1.5", className)}>
      {children}
    </Button>
  );
}

export function ScriptEditor({
  autoSaveIntervalMs = 30_000,
  deliverableId,
  fileBaseName = "script",
  getSignedUrl,
  initialHtml = "<p></p>",
  onSaved,
  saveMetadata,
  brandId,
  initialBrandRules,
  onSaveBrandRules,
}: ScriptEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSaveMode, setLastSaveMode] = useState<SaveMode | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [hookBrowserOpen, setHookBrowserOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("none");

  const [leftTab, setLeftTab] = useState<LeftTab>("templates");
  const [rightTab, setRightTab] = useState<RightTab>("stats");
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(true);

  const [scriptText, setScriptText] = useState("");
  const [highlights, setHighlights] = useState<ComplianceHighlight[]>([]);
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  const turndownRef = useRef(new TurndownService());
  const lastSavedContentRef = useRef<string>("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      CharacterCount.configure(),
    ],
    content: initialHtml,
    onCreate: ({ editor: editorInstance }) => {
      setScriptText(editorInstance.getText({ blockSeparator: "\n\n" }));
    },
    onUpdate: ({ editor: editorInstance }) => {
      setIsDirty(true);
      setError(null);
      setScriptText(editorInstance.getText({ blockSeparator: "\n\n" }));
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] rounded-xl border border-slate-200 bg-white p-4 text-sm outline-none transition-shadow focus-within:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]",
      },
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        leftTab: LeftTab;
        rightTab: RightTab;
        showAnalyticsPanel: boolean;
      }>;

      if (parsed.leftTab === "templates" || parsed.leftTab === "hooks") {
        setLeftTab(parsed.leftTab);
      }
      if (
        parsed.rightTab === "stats" ||
        parsed.rightTab === "compliance" ||
        parsed.rightTab === "analytics"
      ) {
        setRightTab(parsed.rightTab);
      }
      if (typeof parsed.showAnalyticsPanel === "boolean") {
        setShowAnalyticsPanel(parsed.showAnalyticsPanel);
      }
    } catch {
      // Ignore bad local state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ leftTab, rightTab, showAnalyticsPanel });
    window.localStorage.setItem(UI_STATE_STORAGE_KEY, payload);
  }, [leftTab, rightTab, showAnalyticsPanel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(getVersionsStorageKey(deliverableId));
      if (!stored) return;
      const parsed = JSON.parse(stored) as ScriptVersion[];
      if (!Array.isArray(parsed)) return;
      setVersions(parsed);
    } catch {
      setVersions([]);
    }
  }, [deliverableId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getVersionsStorageKey(deliverableId), JSON.stringify(versions));
  }, [deliverableId, versions]);

  useEffect(() => {
    if (!editor) return;
    setScriptText(editor.getText({ blockSeparator: "\n\n" }));
  }, [editor]);

  const wordCount = useMemo(() => {
    if (!editor) return 0;
    return editor.storage.characterCount.words() as number;
  }, [editor, editor?.state]);

  const hasBrandRules = useMemo(() => hasActiveRules(initialBrandRules), [initialBrandRules]);

  const buildSavePayload = useCallback(() => {
    if (!editor) {
      throw new Error("Editor not ready");
    }

    const html = editor.getHTML();
    const markdown = turndownRef.current.turndown(html).trim();
    const normalizedMarkdown = markdown.length > 0 ? `${markdown}\n` : "";
    const plainText = editor.getText({ blockSeparator: "\n\n" }).trim();
    const blob = new Blob([normalizedMarkdown], { type: "text/markdown;charset=utf-8" });

    return { blob, markdown: normalizedMarkdown, plainText };
  }, [editor]);

  const pushVersion = useCallback((content: string, savedAt: Date) => {
    if (!content.trim()) return;

    setVersions((prev) => {
      const nextVersionNumber = (prev[0]?.version ?? 0) + 1;
      const next: ScriptVersion = {
        version: nextVersionNumber,
        content,
        saved_at: savedAt.toISOString(),
        word_count: countWordsFromText(content),
      };
      return [next, ...prev].slice(0, 80);
    });
  }, []);

  const saveDraft = useCallback(
    async (mode: SaveMode) => {
      if (!editor || isSaving) {
        return;
      }

      try {
        setIsSaving(true);
        setError(null);

        const { blob, markdown, plainText } = buildSavePayload();
        if (!markdown.trim()) {
          setIsSaving(false);
          return;
        }

        if (mode === "auto" && markdown === lastSavedContentRef.current) {
          setIsSaving(false);
          setIsDirty(false);
          return;
        }

        const savedAt = new Date();
        const fileName = `${fileBaseName}-${formatTimestamp(savedAt)}.md`;
        const signed = await getSignedUrl({
          deliverableId,
          assetType: "SCRIPT",
          fileName,
          mimeType: "text/markdown",
          fileSizeBytes: blob.size,
        });

        await uploadWithSignedUrl({
          signedUrl: signed.signedUrl,
          method: signed.method ?? "PUT",
          headers: signed.headers ?? { "Content-Type": "text/markdown" },
          body: blob,
        });

        const metadataInput: SaveMetadataInput = {
          deliverableId,
          assetType: "SCRIPT",
          fileName,
          filePath: signed.path,
          fileSizeBytes: blob.size,
          mimeType: "text/markdown",
          durationSeconds: null,
          dimensions: null,
        };

        await saveMetadata(metadataInput);

        lastSavedContentRef.current = markdown;
        setLastSavedAt(savedAt);
        setLastSaveMode(mode);
        setIsDirty(false);
        pushVersion(plainText, savedAt);
        onSaved?.();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save script");
      } finally {
        setIsSaving(false);
      }
    },
    [
      buildSavePayload,
      deliverableId,
      editor,
      fileBaseName,
      getSignedUrl,
      isSaving,
      onSaved,
      pushVersion,
      saveMetadata,
    ],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isDirty || isSaving) return;
      void saveDraft("auto");
    }, autoSaveIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoSaveIntervalMs, isDirty, isSaving, saveDraft]);

  const insertAtCursor = useCallback(
    (value: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(scriptTextToHtml(value)).run();
    },
    [editor],
  );

  const applyComplianceScriptChange = useCallback(
    (nextScript: string) => {
      if (!editor) return;
      editor.commands.setContent(scriptTextToHtml(nextScript), { emitUpdate: false });
      setScriptText(nextScript);
      setIsDirty(true);
    },
    [editor],
  );

  const restoreVersion = useCallback(
    async (version: ScriptVersion) => {
      if (!editor) return;

      try {
        setIsRestoringVersion(true);
        editor.commands.setContent(scriptTextToHtml(version.content), { emitUpdate: false });
        setScriptText(version.content);
        setIsDirty(true);
        setVersionHistoryOpen(false);
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [editor],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) return;

      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        setTemplateSelectorOpen(true);
        return;
      }

      if (key === "h" && !event.shiftKey) {
        event.preventDefault();
        setHookBrowserOpen(true);
        return;
      }

      if (key === "s") {
        event.preventDefault();
        void saveDraft("manual");
        return;
      }

      if (key === "v" && event.shiftKey) {
        event.preventDefault();
        setVersionHistoryOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDraft]);

  if (!editor) return null;

  const statusText = isSaving
    ? `Saving ${lastSaveMode === "auto" ? "(auto)" : "(manual)"}...`
    : lastSavedAt
      ? `Saved ${lastSaveMode ?? "manual"} at ${lastSavedAt.toLocaleTimeString()}`
      : "Not saved yet";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <TemplateSelector
        open={templateSelectorOpen}
        onOpenChange={setTemplateSelectorOpen}
        onInsertAtCursor={insertAtCursor}
      />

      <HookBrowser open={hookBrowserOpen} onOpenChange={setHookBrowserOpen} onInsertAtCursor={insertAtCursor} />

      <VersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        versions={versions}
        currentContent={scriptText}
        onRestore={restoreVersion}
        isRestoring={isRestoringVersion}
      />

      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">Script Editor</p>
          <span className="hidden text-xs text-slate-500 md:inline">
            Cmd/Ctrl+K templates • Cmd/Ctrl+H hooks • Cmd/Ctrl+S save
          </span>
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ToolbarButton onClick={() => setTemplateSelectorOpen(true)}>
            <Wand2 className="h-4 w-4" />
            Templates
          </ToolbarButton>
          <ToolbarButton onClick={() => setHookBrowserOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Hooks
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              setShowAnalyticsPanel((prev) => !prev);
              setRightTab("analytics");
            }}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </ToolbarButton>
          <ToolbarButton onClick={() => setVersionHistoryOpen(true)}>
            <History className="h-4 w-4" />
            Versions
          </ToolbarButton>
          <Button type="button" size="sm" onClick={() => void saveDraft("manual")} loading={isSaving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <aside className="hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3 lg:block">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Library</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setMobilePanel("left")}> 
              <Layers className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton active={leftTab === "templates"} onClick={() => setLeftTab("templates")}>
              Templates
            </EditorTabButton>
            <EditorTabButton active={leftTab === "hooks"} onClick={() => setLeftTab("hooks")}>
              Hooks
            </EditorTabButton>
          </div>

          <div className="mt-3 rounded-lg border bg-white p-3 text-sm transition-all duration-200">
            {leftTab === "templates" ? (
              <div className="space-y-3">
                <p className="font-medium text-slate-900">Template Library</p>
                <p className="text-xs text-slate-600">
                  Start from proven script structures with placeholders and insert directly at cursor.
                </p>
                <Button type="button" size="sm" onClick={() => setTemplateSelectorOpen(true)}>
                  Open Templates
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-medium text-slate-900">Hook Library</p>
                <p className="text-xs text-slate-600">
                  Browse high-performing hooks by category, tone, and platform.
                </p>
                <Button type="button" size="sm" onClick={() => setHookBrowserOpen(true)}>
                  Open Hooks
                </Button>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          {hasBrandRules && highlights.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-medium">Compliance warnings found</p>
              <p className="mt-1 line-clamp-2">
                {highlights
                  .slice(0, 3)
                  .map((highlight) => highlight.value)
                  .join(" • ")}
              </p>
            </div>
          ) : null}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <EditorTabButton
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              Bold
            </EditorTabButton>
            <EditorTabButton
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              Italic
            </EditorTabButton>
            <EditorTabButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              Bullet
            </EditorTabButton>
            <EditorTabButton
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              Numbered
            </EditorTabButton>
          </div>

          <EditorContent editor={editor} />
        </div>

        <aside
          className={cn(
            "hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-all duration-200 lg:block",
            !showAnalyticsPanel && rightTab === "analytics" ? "opacity-50" : "opacity-100",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Insights</p>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton active={rightTab === "stats"} onClick={() => setRightTab("stats")}> 
              Stats
            </EditorTabButton>
            <EditorTabButton active={rightTab === "compliance"} onClick={() => setRightTab("compliance")}> 
              Compliance
            </EditorTabButton>
            <EditorTabButton active={rightTab === "analytics"} onClick={() => setRightTab("analytics")}> 
              Analytics
            </EditorTabButton>
          </div>

          <div className="mt-3 max-h-[62vh] overflow-y-auto pr-1">
            {rightTab === "stats" ? <ScriptStats text={scriptText} /> : null}

            {rightTab === "compliance" ? (
              <CompliancePanel
                script={scriptText}
                onScriptChange={applyComplianceScriptChange}
                brandId={brandId}
                initialRules={initialBrandRules}
                onSaveRules={onSaveBrandRules}
                onHighlightsChange={setHighlights}
              />
            ) : null}

            {rightTab === "analytics" && showAnalyticsPanel ? <ScriptAnalytics text={scriptText} /> : null}

            {rightTab === "analytics" && !showAnalyticsPanel ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                Analytics panel is hidden. Use the toolbar Analytics button to show it.
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-900">{wordCount} words</span>
          <span className="hidden sm:inline">Auto-save every {Math.round(autoSaveIntervalMs / 1000)}s</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
              isSaving ? "animate-pulse bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700",
            )}
          >
            {isSaving ? <FileClock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {statusText}
          </span>
          {isDirty && !isSaving ? <span className="text-amber-700">Unsaved changes</span> : null}
        </div>

        <button
          type="button"
          className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          onClick={() => setVersionHistoryOpen(true)}
        >
          Open version history
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="bottom-0 top-auto translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Editor Actions</DialogTitle>
            <DialogDescription>Open libraries and insights without leaving the editor.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                setTemplateSelectorOpen(true);
              }}
            >
              Templates
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                setHookBrowserOpen(true);
              }}
            >
              Hooks
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                setMobilePanel("right");
              }}
            >
              Insights
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                setMobilePanel("left");
              }}
            >
              Library
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMobileMenuOpen(false);
                setVersionHistoryOpen(true);
              }}
            >
              Versions
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void saveDraft("manual");
              }}
              loading={isSaving}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobilePanel === "left"} onOpenChange={(open) => setMobilePanel(open ? "left" : "none")}>
        <DialogContent className="bottom-0 top-auto translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Library</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton active={leftTab === "templates"} onClick={() => setLeftTab("templates")}>
              Templates
            </EditorTabButton>
            <EditorTabButton active={leftTab === "hooks"} onClick={() => setLeftTab("hooks")}>
              Hooks
            </EditorTabButton>
          </div>
          <div className="mt-3 rounded-lg border bg-white p-3">
            {leftTab === "templates" ? (
              <Button type="button" onClick={() => setTemplateSelectorOpen(true)}>
                Open Templates
              </Button>
            ) : (
              <Button type="button" onClick={() => setHookBrowserOpen(true)}>
                Open Hooks
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobilePanel === "right"} onOpenChange={(open) => setMobilePanel(open ? "right" : "none")}>
        <DialogContent className="bottom-0 top-auto h-[75vh] translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Insights</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton active={rightTab === "stats"} onClick={() => setRightTab("stats")}> 
              Stats
            </EditorTabButton>
            <EditorTabButton active={rightTab === "compliance"} onClick={() => setRightTab("compliance")}> 
              Compliance
            </EditorTabButton>
            <EditorTabButton active={rightTab === "analytics"} onClick={() => setRightTab("analytics")}> 
              Analytics
            </EditorTabButton>
          </div>
          <div className="mt-3 h-full overflow-y-auto pr-1">
            {rightTab === "stats" ? <ScriptStats text={scriptText} /> : null}
            {rightTab === "compliance" ? (
              <CompliancePanel
                script={scriptText}
                onScriptChange={applyComplianceScriptChange}
                brandId={brandId}
                initialRules={initialBrandRules}
                onSaveRules={onSaveBrandRules}
                onHighlightsChange={setHighlights}
              />
            ) : null}
            {rightTab === "analytics" ? <ScriptAnalytics text={scriptText} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export type { ScriptEditorProps, SaveMetadataInput };
