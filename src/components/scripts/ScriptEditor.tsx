"use client";

import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  History,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MoreHorizontal,
  Redo,
  Save,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TurndownService from "turndown";
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
  type BrandRules,
  type ComplianceHighlight,
  CompliancePanel,
} from "@/src/components/scripts/CompliancePanel";
import { HookBrowser } from "@/src/components/scripts/HookBrowser";
import { ScriptAnalytics } from "@/src/components/scripts/ScriptAnalytics";
import { ScriptStats } from "@/src/components/scripts/ScriptStats";
import { TemplateSelector } from "@/src/components/scripts/TemplateSelector";
import {
  type ScriptVersion,
  VersionHistory,
} from "@/src/components/scripts/VersionHistory";

// ... (existing types remain same)

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
  onSaveBrandRules?: (input: {
    brandId: string;
    rules: BrandRules;
  }) => Promise<void> | void;
};

const UI_STATE_STORAGE_KEY = "creatorops.scripteditor.ui";
function getDraftStorageKey(deliverableId: string) {
  return `creatorops.script.draft.${deliverableId}`;
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[-:.]/g, "");
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
        "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active
          ? "dash-bg-card text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 dash-bg-card hover:text-slate-900",
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
  isActive,
  tooltip,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  tooltip?: string;
  disabled?: boolean;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={cn(
        "h-8 w-8 p-0 text-slate-500 dash-bg-card hover:text-slate-900",
        isActive && "dash-bg-card text-slate-900 font-medium",
        className,
      )}
    >
      {children}
    </Button>
  );

  return button;
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
  // ... (existing state remains same)
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
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false);

  const turndownRef = useRef(new TurndownService());
  const lastSavedContentRef = useRef<string>("");
  const lastDraftHtmlRef = useRef<string>("");
  const hasHydratedInitialRef = useRef(false);
  const lastSeenInitialHtmlRef = useRef(initialHtml);
  const pendingRemoteHtmlRef = useRef<string | null>(null);
  const inFlightSaveRef = useRef(false);
  const pendingAutoSaveRef = useRef(false);
  const idleAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const draftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-blue-500 underline cursor-pointer",
          },
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Placeholder.configure({
          placeholder: "Start writing your script...",
        }),
        CharacterCount.configure(),
      ],
      content: "<p></p>",
      onCreate: ({ editor: editorInstance }) => {
        setScriptText(editorInstance.getText({ blockSeparator: "\n\n" }));
        lastDraftHtmlRef.current = editorInstance.getHTML();
      },
      onUpdate: ({ editor: editorInstance }) => {
        setIsDirty((prev) => prev || true);
        setError((prev) => (prev === null ? prev : null));

        const nextText = editorInstance.getText({ blockSeparator: "\n\n" });
        setScriptText((prev) => (prev === nextText ? prev : nextText));

        if (typeof window !== "undefined") {
          const html = editorInstance.getHTML();
          if (lastDraftHtmlRef.current !== html) {
            lastDraftHtmlRef.current = html;
            if (draftPersistTimerRef.current !== null) {
              clearTimeout(draftPersistTimerRef.current);
            }
            draftPersistTimerRef.current = setTimeout(() => {
              window.localStorage.setItem(
                getDraftStorageKey(deliverableId),
                lastDraftHtmlRef.current,
              );
              draftPersistTimerRef.current = null;
            }, 300);
          }
        }
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-slate mx-auto min-h-[60vh] w-full max-w-prose bg-transparent px-4 py-12 outline-none focus:outline-none sm:prose-lg sm:px-8 [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc",
        },
      },
    },
    [deliverableId],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (!hasHydratedInitialRef.current) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
      setScriptText(editor.getText({ blockSeparator: "\n\n" }));
      lastDraftHtmlRef.current = initialHtml;
      hasHydratedInitialRef.current = true;
      lastSeenInitialHtmlRef.current = initialHtml;
      return;
    }

    if (initialHtml === lastSeenInitialHtmlRef.current) {
      return;
    }

    lastSeenInitialHtmlRef.current = initialHtml;

    if (isDirty) {
      pendingRemoteHtmlRef.current = initialHtml;
      setHasRemoteUpdate(true);
      return;
    }

    editor.commands.setContent(initialHtml, { emitUpdate: false });
    setScriptText(editor.getText({ blockSeparator: "\n\n" }));
    lastDraftHtmlRef.current = initialHtml;
  }, [editor, initialHtml, isDirty]);

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

    hasHydratedInitialRef.current = false;
    lastSeenInitialHtmlRef.current = initialHtml;
    pendingRemoteHtmlRef.current = null;
    setHasRemoteUpdate(false);

    try {
      const stored = window.localStorage.getItem(
        getVersionsStorageKey(deliverableId),
      );
      if (!stored) return;
      const parsed = JSON.parse(stored) as ScriptVersion[];
      if (!Array.isArray(parsed)) return;
      setVersions(parsed);
    } catch {
      setVersions([]);
    }
  }, [deliverableId, initialHtml]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      getVersionsStorageKey(deliverableId),
      JSON.stringify(versions),
    );
  }, [deliverableId, versions]);

  useEffect(() => {
    if (!editor || typeof window === "undefined") return;

    const storedDraft = window.localStorage.getItem(
      getDraftStorageKey(deliverableId),
    );
    if (!storedDraft) return;

    const currentText = editor.getText({ blockSeparator: "\n\n" }).trim();
    if (currentText.length > 0) return;

    editor.commands.setContent(storedDraft, { emitUpdate: false });
    lastDraftHtmlRef.current = storedDraft;
    setScriptText(editor.getText({ blockSeparator: "\n\n" }));
    setIsDirty(true);
  }, [deliverableId, editor]);

  useEffect(() => {
    return () => {
      if (draftPersistTimerRef.current !== null) {
        clearTimeout(draftPersistTimerRef.current);
      }
      if (idleAutoSaveTimerRef.current !== null) {
        clearTimeout(idleAutoSaveTimerRef.current);
      }
    };
  }, []);

  const wordCount = useMemo(() => {
    if (!editor) return 0;
    return editor.storage.characterCount.words() as number;
  }, [editor, editor?.state]);

  const hasBrandRules = useMemo(
    () => hasActiveRules(initialBrandRules),
    [initialBrandRules],
  );

  const buildSavePayload = useCallback(() => {
    if (!editor) {
      throw new Error("Editor not ready");
    }

    const html = editor.getHTML();
    const markdown = turndownRef.current.turndown(html).trim();
    const normalizedMarkdown = markdown.length > 0 ? `${markdown}\n` : "";
    const plainText = editor.getText({ blockSeparator: "\n\n" }).trim();
    const blob = new Blob([normalizedMarkdown], {
      type: "text/markdown;charset=utf-8",
    });

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
      if (!editor) {
        return;
      }

      if (inFlightSaveRef.current) {
        if (mode === "auto") {
          pendingAutoSaveRef.current = true;
        }
        return;
      }

      try {
        inFlightSaveRef.current = true;
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
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save script",
        );
      } finally {
        inFlightSaveRef.current = false;
        setIsSaving(false);
        if (mode === "auto" && pendingAutoSaveRef.current) {
          pendingAutoSaveRef.current = false;
          void saveDraft("auto");
        }
      }
    },
    [
      buildSavePayload,
      deliverableId,
      editor,
      fileBaseName,
      getSignedUrl,
      onSaved,
      pushVersion,
      saveMetadata,
    ],
  );

  const queueAutoSave = useCallback(() => {
    if (!isDirty) return;
    pendingAutoSaveRef.current = true;
    if (inFlightSaveRef.current) return;
    pendingAutoSaveRef.current = false;
    void saveDraft("auto");
  }, [isDirty, saveDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      queueAutoSave();
    }, autoSaveIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoSaveIntervalMs, queueAutoSave]);

  // Debounced auto-save (1s after stopping typing)
  useEffect(() => {
    if (!isDirty) return;

    if (idleAutoSaveTimerRef.current !== null) {
      clearTimeout(idleAutoSaveTimerRef.current);
    }

    idleAutoSaveTimerRef.current = setTimeout(() => {
      queueAutoSave();
      idleAutoSaveTimerRef.current = null;
    }, 1000);

    return () => {
      if (idleAutoSaveTimerRef.current !== null) {
        clearTimeout(idleAutoSaveTimerRef.current);
        idleAutoSaveTimerRef.current = null;
      }
    };
  }, [isDirty, queueAutoSave]);

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
      editor.commands.setContent(scriptTextToHtml(nextScript), {
        emitUpdate: false,
      });
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
        editor.commands.setContent(scriptTextToHtml(version.content), {
          emitUpdate: false,
        });
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

  const applyRemoteUpdate = useCallback(() => {
    if (!editor || !pendingRemoteHtmlRef.current) {
      return;
    }

    editor.commands.setContent(pendingRemoteHtmlRef.current, {
      emitUpdate: false,
    });
    setScriptText(editor.getText({ blockSeparator: "\n\n" }));
    lastDraftHtmlRef.current = pendingRemoteHtmlRef.current;
    pendingRemoteHtmlRef.current = null;
    setHasRemoteUpdate(false);
    setIsDirty(false);
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const statusText = isSaving
    ? `Saving ${lastSaveMode === "auto" ? "(auto)" : "(manual)"}...`
    : lastSavedAt
      ? `Saved ${lastSaveMode ?? "manual"} at ${lastSavedAt.toLocaleTimeString()}`
      : "Not saved yet";

  return (
    <section className="flex flex-col gap-4">
      {/* ... (Dialogs remain same) */}
      <TemplateSelector
        open={templateSelectorOpen}
        onOpenChange={setTemplateSelectorOpen}
        onInsertAtCursor={insertAtCursor}
      />

      <HookBrowser
        open={hookBrowserOpen}
        onOpenChange={setHookBrowserOpen}
        onInsertAtCursor={insertAtCursor}
      />

      <VersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        versions={versions}
        currentContent={scriptText}
        onRestore={restoreVersion}
        isRestoring={isRestoringVersion}
      />

      {/* Improved Toolbar */}
      <div className="sticky top-0 z-10 mx-auto max-w-prose rounded-xl border dash-border dash-bg-card px-2 py-2 backdrop-blur-md transition-all">
        <div className="flex flex-wrap items-center gap-1">
          {/* History */}
          <div className="flex items-center gap-1 pr-1 border-r dash-border">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              tooltip="Undo (Cmd+Z)"
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              tooltip="Redo (Cmd+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Text Style */}
          <div className="flex items-center gap-1 px-1 border-r dash-border">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              tooltip="Bold (Cmd+B)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              tooltip="Italic (Cmd+I)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive("underline")}
              tooltip="Underline (Cmd+U)"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              tooltip="Strikethrough (Cmd+Shift+S)"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              tooltip="Inline Code (Cmd+E)"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Structure */}
          <div className="flex items-center gap-1 px-1 border-r dash-border hidden sm:flex">
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              isActive={editor.isActive("heading", { level: 1 })}
              tooltip="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              isActive={editor.isActive("heading", { level: 2 })}
              tooltip="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              isActive={editor.isActive("heading", { level: 3 })}
              tooltip="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Lists & Alignment */}
          <div className="flex items-center gap-1 px-1 border-r dash-border hidden md:flex">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              tooltip="Bullet List"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              tooltip="Ordered List"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              isActive={editor.isActive({ textAlign: "left" })}
              tooltip="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              isActive={editor.isActive({ textAlign: "center" })}
              tooltip="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              isActive={editor.isActive({ textAlign: "right" })}
              tooltip="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Insert & Actions */}
          <div className="flex items-center gap-1 px-1">
            <ToolbarButton
              onClick={addLink}
              isActive={editor.isActive("link")}
              tooltip="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <div className="flex-1" />

          {/* Primary Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:flex"
              onClick={() => setTemplateSelectorOpen(true)}
            >
              <Wand2 className="mr-2 h-3.5 w-3.5" />
              Templates
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 sm:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => void saveDraft("manual")}
              loading={isSaving}
              className="gap-1.5 dash-bg-panel text-xs font-medium text-white dash-bg-panel"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* ... (Main layout with Sidebars and Editor) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_21rem]">
        {/* LEFT SIDEBAR: Library */}
        <aside className="hidden flex-col gap-4 xl:flex">
          {/* ... (Library content) */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border dash-border dash-bg-card p-4 transition-all">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Library</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Access templates and hooks to speed up your writing.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setTemplateSelectorOpen(true)}
                  >
                    <Wand2 className="mr-2 h-3.5 w-3.5" />
                    Templates
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setHookBrowserOpen(true)}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Hooks
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border dash-border dash-bg-card p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Shortcuts</h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Save</span>
                      <kbd className="font-sans">Cmd+S</kbd>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Templates</span>
                      <kbd className="font-sans">Cmd+K</kbd>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Hooks</span>
                      <kbd className="font-sans">Cmd+H</kbd>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Undo</span>
                      <kbd className="font-sans">Cmd+Z</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER: Editor */}
        <main className="flex min-w-0 flex-col gap-4">
          <div className="relative flex-1">
            {hasBrandRules && highlights.length > 0 && (
              <div className="absolute right-4 top-4 z-10 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm">
                {highlights.length} compliance issues
              </div>
            )}

            <EditorContent editor={editor} />
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border dash-border dash-bg-card px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-xs font-semibold tabular-nums text-slate-900">
                  {wordCount}
                </span>
                <span className="text-[10px] lowercase text-slate-500 uppercase tracking-wide">
                  words
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isSaving
                      ? "bg-blue-500 animate-pulse"
                      : isDirty
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                />
                <span className="text-[10px] text-slate-500">{statusText}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 px-2 text-xs",
                  showAnalyticsPanel &&
                    rightTab === "analytics" &&
                    "dash-bg-card",
                )}
                onClick={() => {
                  if (rightTab === "analytics" && showAnalyticsPanel) {
                    setShowAnalyticsPanel(false);
                  } else {
                    setRightTab("analytics");
                    setShowAnalyticsPanel(true);
                  }
                }}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setVersionHistoryOpen(true)}
              >
                <History className="h-3.5 w-3.5" />
                History
              </Button>
            </div>
          </div>
        </main>
        <section
          className={cn(
            "hidden rounded-xl border dash-border dash-bg-card p-4 xl:block 2xl:hidden",
            !showAnalyticsPanel && rightTab === "analytics"
              ? "opacity-50 grayscale"
              : "opacity-100",
          )}
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Insights
            </p>
          </div>
          <div className="mt-3 flex w-full rounded-lg dash-bg-card p-1">
            <button
              type="button"
              onClick={() => setRightTab("stats")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                rightTab === "stats"
                  ? "dash-bg-card text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Stats
            </button>
            <button
              type="button"
              onClick={() => setRightTab("compliance")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                rightTab === "compliance"
                  ? "dash-bg-card text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => setRightTab("analytics")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                rightTab === "analytics"
                  ? "dash-bg-card text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              AI Data
            </button>
          </div>
          <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
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
            {rightTab === "analytics" && showAnalyticsPanel ? (
              <ScriptAnalytics text={scriptText} />
            ) : null}
            {rightTab === "analytics" && !showAnalyticsPanel ? (
              <div className="rounded-lg border dash-border dash-bg-card p-3 text-sm text-slate-600">
                Analytics panel is hidden. Use the toolbar Analytics button to
                show it.
              </div>
            ) : null}
          </div>
        </section>

        {/* RIGHT SIDEBAR: Insights */}
        <aside
          className={cn(
            "hidden flex-col gap-4 2xl:flex",
            !showAnalyticsPanel && rightTab === "analytics"
              ? "opacity-50 grayscale"
              : "opacity-100",
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Insights
              </p>
            </div>

            <div className="flex w-full rounded-lg dash-bg-card p-1">
              <button
                type="button"
                onClick={() => setRightTab("stats")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                  rightTab === "stats"
                    ? "dash-bg-card text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                Stats
              </button>
              <button
                type="button"
                onClick={() => setRightTab("compliance")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                  rightTab === "compliance"
                    ? "dash-bg-card text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => setRightTab("analytics")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                  rightTab === "analytics"
                    ? "dash-bg-card text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                AI Data
              </button>
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

              {rightTab === "analytics" && showAnalyticsPanel ? (
                <ScriptAnalytics text={scriptText} />
              ) : null}

              {rightTab === "analytics" && !showAnalyticsPanel ? (
                <div className="rounded-lg border dash-border dash-bg-card p-3 text-sm text-slate-600">
                  Analytics panel is hidden. Use the toolbar Analytics button to
                  show it.
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {hasRemoteUpdate ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>A newer remote version is available.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={applyRemoteUpdate}
          >
            Apply remote update
          </Button>
        </div>
      ) : null}

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="bottom-0 top-auto translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Editor Actions</DialogTitle>
            <DialogDescription>
              Open libraries and insights without leaving the editor.
            </DialogDescription>
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

      <Dialog
        open={mobilePanel === "left"}
        onOpenChange={(open) => setMobilePanel(open ? "left" : "none")}
      >
        <DialogContent className="bottom-0 top-auto translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Library</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton
              active={leftTab === "templates"}
              onClick={() => setLeftTab("templates")}
            >
              Templates
            </EditorTabButton>
            <EditorTabButton
              active={leftTab === "hooks"}
              onClick={() => setLeftTab("hooks")}
            >
              Hooks
            </EditorTabButton>
          </div>
          <div className="mt-3 rounded-lg border dash-bg-card p-3">
            {leftTab === "templates" ? (
              <Button
                type="button"
                onClick={() => setTemplateSelectorOpen(true)}
              >
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

      <Dialog
        open={mobilePanel === "right"}
        onOpenChange={(open) => setMobilePanel(open ? "right" : "none")}
      >
        <DialogContent className="bottom-0 top-auto h-[75vh] translate-x-[-50%] translate-y-0 rounded-t-xl rounded-b-none p-4 md:hidden">
          <DialogHeader>
            <DialogTitle>Insights</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-1">
            <EditorTabButton
              active={rightTab === "stats"}
              onClick={() => setRightTab("stats")}
            >
              Stats
            </EditorTabButton>
            <EditorTabButton
              active={rightTab === "compliance"}
              onClick={() => setRightTab("compliance")}
            >
              Compliance
            </EditorTabButton>
            <EditorTabButton
              active={rightTab === "analytics"}
              onClick={() => setRightTab("analytics")}
            >
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
            {rightTab === "analytics" ? (
              <ScriptAnalytics text={scriptText} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export type { ScriptEditorProps, SaveMetadataInput };
