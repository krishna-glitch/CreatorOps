"use client";

import {
  Camera,
  Clapperboard,
  Copy,
  Globe,
  Music2,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  hookCategories,
  hookLibrary,
  hookTones,
  type HookPlatform,
  type HookTemplate,
  type HookTone,
  type HookVariable,
} from "@/src/lib/templates/hookLibrary";

const RECENT_HOOKS_STORAGE_KEY = "creatorops_recent_hooks";
const RECENT_HOOKS_LIMIT = 8;
const CATEGORY_ALL = "All" as const;
const TONE_ALL = "All" as const;

const platformFilters: HookPlatform[] = ["All", "Instagram", "YouTube", "TikTok"];
const toneFilters: Array<typeof TONE_ALL | HookTone> = ["All", ...hookTones];

const platformIconByName: Record<HookPlatform, React.ReactNode> = {
  All: <Globe className="h-4 w-4" />,
  Instagram: <Camera className="h-4 w-4" />,
  YouTube: <Clapperboard className="h-4 w-4" />,
  TikTok: <Music2 className="h-4 w-4" />,
};

type HookBrowserProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertAtCursor: (value: string) => void;
  className?: string;
};

type HookValuesState = Partial<Record<HookVariable, string>>;

function applyVariables(hook: HookTemplate, values: HookValuesState): string {
  if (!hook.variables || hook.variables.length === 0) {
    return hook.text;
  }

  return hook.variables.reduce((text, variable) => {
    const replacement = values[variable]?.trim() || `{${variable}}`;
    return text.replaceAll(`{${variable}}`, replacement);
  }, hook.text);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
    return true;
  }

  return target.isContentEditable;
}

export function HookBrowser({
  open,
  onOpenChange,
  onInsertAtCursor,
  className,
}: HookBrowserProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_ALL | HookTemplate["category"]>(
    CATEGORY_ALL,
  );
  const [platformFilter, setPlatformFilter] = useState<HookPlatform>("All");
  const [toneFilter, setToneFilter] = useState<typeof TONE_ALL | HookTone>("All");
  const [recentHookIds, setRecentHookIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [valuesByHookId, setValuesByHookId] = useState<Record<string, HookValuesState>>({});

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(RECENT_HOOKS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        setRecentHookIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      setRecentHookIds([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(RECENT_HOOKS_STORAGE_KEY, JSON.stringify(recentHookIds));
  }, [recentHookIds]);

  const filteredHooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return hookLibrary.filter((hook) => {
      const categoryMatch = categoryFilter === CATEGORY_ALL || hook.category === categoryFilter;
      const platformMatch =
        platformFilter === "All" || hook.platform === "All" || hook.platform === platformFilter;
      const toneMatch = toneFilter === TONE_ALL || hook.tone === toneFilter;
      const searchMatch =
        normalizedSearch.length === 0 ||
        hook.text.toLowerCase().includes(normalizedSearch) ||
        hook.category.toLowerCase().includes(normalizedSearch);

      return categoryMatch && platformMatch && toneMatch && searchMatch;
    });
  }, [search, categoryFilter, platformFilter, toneFilter]);

  const recentHooks = useMemo(() => {
    const map = new Map(hookLibrary.map((hook) => [hook.id, hook]));
    return recentHookIds
      .map((id) => map.get(id))
      .filter((hook): hook is HookTemplate => Boolean(hook));
  }, [recentHookIds]);

  useEffect(() => {
    if (activeIndex >= filteredHooks.length) {
      setActiveIndex(filteredHooks.length > 0 ? filteredHooks.length - 1 : 0);
    }
  }, [filteredHooks, activeIndex]);

  useEffect(() => {
    const activeHook = filteredHooks[activeIndex];
    if (!activeHook) {
      return;
    }

    const node = cardRefs.current[activeHook.id];
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex, filteredHooks]);

  const rememberHook = (hookId: string) => {
    setRecentHookIds((prev) => [hookId, ...prev.filter((id) => id !== hookId)].slice(0, RECENT_HOOKS_LIMIT));
  };

  const handleValueChange = (hookId: string, variable: HookVariable, value: string) => {
    setValuesByHookId((prev) => ({
      ...prev,
      [hookId]: {
        ...(prev[hookId] ?? {}),
        [variable]: value,
      },
    }));
  };

  const useHook = (hook: HookTemplate) => {
    const text = applyVariables(hook, valuesByHookId[hook.id] ?? {});
    onInsertAtCursor(text);
    rememberHook(hook.id);
    toast.success("Hook inserted at cursor");
  };

  const copyHook = async (hook: HookTemplate) => {
    const text = applyVariables(hook, valuesByHookId[hook.id] ?? {});

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Hook copied");
      rememberHook(hook.id);
    } catch {
      toast.error("Failed to copy hook");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open || filteredHooks.length === 0 || isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredHooks.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredHooks.length) % filteredHooks.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const hook = filteredHooks[activeIndex];
      if (hook) {
        useHook(hook);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("w-[min(96vw,68rem)] max-w-[68rem] gap-0 p-0 overflow-hidden rounded-xl", className)}
        onKeyDown={handleKeyDown}
      >
        <div className="grid h-[85vh] grid-rows-[auto_auto_1fr] overflow-hidden">
          <DialogHeader className="border-b dash-border dash-bg-card px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Hook Browser
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Search, customize, copy, and insert high-performing hooks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 border-b dash-border dash-bg-card px-6 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search hooks by text or category..."
                className="pl-9 dash-bg-card dash-border text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="min-w-[140px]">
                <Select
                  value={categoryFilter}
                  onValueChange={(value) =>
                    setCategoryFilter(value as typeof CATEGORY_ALL | HookTemplate["category"])
                  }
                >
                  <SelectTrigger className="h-8 dash-border dash-bg-card text-xs text-slate-900">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_ALL}>All categories</SelectItem>
                    {hookCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {platformFilters.map((platform) => {
                  const selected = platformFilter === platform;
                  return (
                    <Button
                      key={platform}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPlatformFilter(platform)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                        selected
                          ? "border-slate-900 dash-bg-panel text-white dash-bg-panel hover:text-white"
                          : "dash-border dash-bg-card text-slate-600 dash-border dash-bg-card hover:text-slate-900"
                      )}
                    >
                      {platformIconByName[platform]}
                      <span className="ml-1.5">{platform}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {toneFilters.map((tone) => {
                  const selected = toneFilter === tone;
                  return (
                    <Button
                      key={tone}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setToneFilter(tone)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                        selected
                          ? "border-slate-900 dash-bg-panel text-white dash-bg-panel hover:text-white"
                          : "dash-border dash-bg-card text-slate-600 dash-border dash-bg-card hover:text-slate-900"
                      )}
                    >
                      {tone}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid min-h-0 gap-0 overflow-hidden lg:grid-cols-[18rem_1fr]">
            <aside className="min-h-0 overflow-y-auto border-r dash-border dash-bg-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Recently Used</h3>

              <div className="space-y-2">
                {recentHooks.length === 0 ? (
                  <div className="rounded-lg border border-dashed dash-border p-4 text-center">
                    <p className="text-xs text-slate-400">No recent hooks</p>
                  </div>
                ) : (
                  recentHooks.map((hook) => (
                    <button
                      key={hook.id}
                      type="button"
                      onClick={() => useHook(hook)}
                      className="group w-full rounded-lg border dash-border dash-bg-card p-3 text-left transition-all dash-border hover:shadow-sm"
                    >
                      <p className="line-clamp-2 text-xs font-medium text-slate-700 group-hover:text-slate-900">{applyVariables(hook, valuesByHookId[hook.id] ?? {})}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="secondary" className="dash-bg-card text-[10px] text-slate-500">{hook.category}</Badge>
                        <span className="text-slate-400">{platformIconByName[hook.platform]}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto dash-bg-card p-6">
              {filteredHooks.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed dash-border dash-bg-card text-center text-sm text-slate-500">
                  <Search className="mb-2 h-8 w-8 text-slate-300" />
                  <p>No hooks found</p>
                  <p className="text-xs">Try adjusting filters or search.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHooks.map((hook, index) => {
                    const isActive = index === activeIndex;
                    const hasVariables = Boolean(hook.variables?.length);

                    return (
                      <Card
                        key={hook.id}
                        ref={(node) => {
                          cardRefs.current[hook.id] = node;
                        }}
                        className={cn(
                          "dash-border transition-all shadow-sm",
                          isActive ? "border-slate-900 ring-1 ring-slate-900/10 shadow-md" : "dash-border hover:shadow-md"
                        )}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <p className="flex-1 text-base font-medium leading-relaxed text-slate-900">
                              {applyVariables(hook, valuesByHookId[hook.id] ?? {})}
                            </p>
                            <div className="flex shrink-0 items-center justify-center h-8 w-8 rounded-full dash-bg-card text-slate-400">
                              {platformIconByName[hook.platform]}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="dash-bg-card text-slate-700 hover:bg-slate-200">{hook.category}</Badge>
                            <Badge variant="outline" className="dash-border text-slate-500">{hook.tone}</Badge>
                            {isActive ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 animate-pulse">
                                Selected (Press Enter)
                              </Badge>
                            ) : null}
                          </div>

                          {hasVariables ? (
                            <div className="mt-4 rounded-lg border dash-border dash-bg-card p-3">
                              <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                                Customize Placeholders
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {hook.variables?.map((variable) => (
                                  <Input
                                    key={`${hook.id}-${variable}`}
                                    value={valuesByHookId[hook.id]?.[variable] ?? ""}
                                    onChange={(event) =>
                                      handleValueChange(hook.id, variable, event.target.value)
                                    }
                                    placeholder={`Enter ${variable}...`}
                                    className="h-9 dash-bg-card dash-border text-xs focus-visible:ring-slate-400"
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                            <Button type="button" size="sm" onClick={() => useHook(hook)} className="dash-bg-panel text-white dash-bg-panel">
                              Use This Hook
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => copyHook(hook)}
                              className="text-slate-600 dash-bg-card hover:text-slate-900"
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { HookBrowserProps };
