"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";

type ScriptVersion = {
  version: number;
  content: string;
  saved_at: string;
  word_count: number;
};

const DEBOUNCE_MS = 1200;
const AUTO_SAVE_INTERVAL_MS = 30_000;

export function useScriptAutoSave(scriptId: string, initialContent: string) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<ScriptVersion[]>([]);

  const contentRef = useRef(content);
  const lastSavedContentRef = useRef(initialContent);
  const hasUnsavedChangesRef = useRef(false);
  const isSavingRef = useRef(false);
  const mountedRef = useRef(true);
  const didHydrateFromServerRef = useRef(false);

  const utils = trpc.useUtils();

  const saveMutation = trpc.mediaAssets.saveScriptVersion.useMutation({
    onMutate: () => {
      setIsSaving(true);
      isSavingRef.current = true;
      setSaveError(null);
    },
    onSuccess: (saved) => {
      if (!mountedRef.current) {
        return;
      }
      const savedDate = new Date(saved.savedAt);
      setLastSaved(savedDate);
      setVersionHistory(saved.versionHistory);
      if (contentRef.current === saved.content) {
        lastSavedContentRef.current = saved.content;
        hasUnsavedChangesRef.current = false;
      }
      void utils.mediaAssets.getScriptVersions.invalidate({ scriptId });
    },
    onError: (error) => {
      if (!mountedRef.current) {
        return;
      }
      setSaveError(error.message || "Could not save script. Will retry.");
    },
    onSettled: () => {
      if (!mountedRef.current) {
        return;
      }
      setIsSaving(false);
      isSavingRef.current = false;
    },
  });

  const versionsQuery = trpc.mediaAssets.getScriptVersions.useQuery(
    { scriptId },
    {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    setContent(initialContent);
    contentRef.current = initialContent;
    lastSavedContentRef.current = initialContent;
    hasUnsavedChangesRef.current = false;
    didHydrateFromServerRef.current = false;
    setLastSaved(null);
    setSaveError(null);
    setVersionHistory([]);
  }, [initialContent, scriptId]);

  useEffect(() => {
    if (!versionsQuery.data) {
      return;
    }

    setVersionHistory(versionsQuery.data.versionHistory);
    if (!didHydrateFromServerRef.current) {
      setContent(versionsQuery.data.content);
      contentRef.current = versionsQuery.data.content;
      lastSavedContentRef.current = versionsQuery.data.content;
      hasUnsavedChangesRef.current = false;
      didHydrateFromServerRef.current = true;
    }
    if (!lastSaved && versionsQuery.data.versionHistory.length > 0) {
      setLastSaved(new Date(versionsQuery.data.versionHistory[0].saved_at));
    }
  }, [lastSaved, versionsQuery.data]);

  useEffect(() => {
    contentRef.current = content;
    hasUnsavedChangesRef.current = content !== lastSavedContentRef.current;
  }, [content]);

  const saveNow = useCallback(async () => {
    const nextContent = contentRef.current;
    if (nextContent === lastSavedContentRef.current) {
      return;
    }

    await saveMutation.mutateAsync({
      scriptId,
      content: nextContent,
    });
  }, [saveMutation, scriptId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hasUnsavedChangesRef.current || isSavingRef.current) {
        return;
      }
      void saveNow();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [content, saveNow]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!hasUnsavedChangesRef.current || isSavingRef.current) {
        return;
      }
      void saveNow();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [saveNow]);

  const hasUnsavedChanges = useMemo(
    () => content !== lastSavedContentRef.current,
    [content],
  );
  const saveStatusText = useMemo(() => {
    if (isSaving) {
      return "Saving...";
    }
    if (saveError) {
      return "Save failed. Retrying...";
    }
    if (lastSaved) {
      return `Saved at ${lastSaved.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return "Not saved yet";
  }, [isSaving, lastSaved, saveError]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current && !isSavingRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    content,
    setContent,
    isSaving,
    lastSaved,
    saveError,
    saveStatusText,
    hasUnsavedChanges,
    versionHistory,
    saveNow,
  };
}
