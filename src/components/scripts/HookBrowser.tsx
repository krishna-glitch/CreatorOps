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
        className={cn("w-[min(96vw,68rem)] max-w-[68rem] p-0", className)}
        onKeyDown={handleKeyDown}
      >
        <div className="grid max-h-[88vh] grid-rows-[auto_auto_1fr] overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5" />
              Hook Browser
            </DialogTitle>
            <DialogDescription>
              Search, customize, copy, and insert high-performing hooks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 border-b px-6 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search hooks by text or category..."
                className="pl-9"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </p>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) =>
                    setCategoryFilter(value as typeof CATEGORY_ALL | HookTemplate["category"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Platform
                </p>
                <div className="flex flex-wrap gap-2">
                  {platformFilters.map((platform) => {
                    const selected = platformFilter === platform;

                    return (
                      <Button
                        key={platform}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        onClick={() => setPlatformFilter(platform)}
                        className="h-8 rounded-full"
                      >
                        {platformIconByName[platform]}
                        {platform}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tone
                </p>
                <div className="flex flex-wrap gap-2">
                  {toneFilters.map((tone) => {
                    const selected = toneFilter === tone;

                    return (
                      <Button
                        key={tone}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        onClick={() => setToneFilter(tone)}
                        className="h-8 rounded-full"
                      >
                        {tone}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 gap-6 overflow-hidden p-6 lg:grid-cols-[20rem_1fr]">
            <aside className="min-h-0 overflow-y-auto rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Recently Used</h3>
              <p className="mt-1 text-xs text-muted-foreground">Most recent hooks you inserted or copied.</p>

              <div className="mt-3 space-y-2">
                {recentHooks.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No recent hooks yet.
                  </p>
                ) : (
                  recentHooks.map((hook) => (
                    <button
                      key={hook.id}
                      type="button"
                      onClick={() => useHook(hook)}
                      className="w-full rounded-md border p-3 text-left text-xs transition hover:bg-muted"
                    >
                      <p className="line-clamp-2 font-medium">{applyVariables(hook, valuesByHookId[hook.id] ?? {})}</p>
                      <p className="mt-1 text-muted-foreground">{hook.category}</p>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto pr-1">
              {filteredHooks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No hooks found. Try adjusting filters or search.
                </div>
              ) : (
                <div className="space-y-3">
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
                          "border transition",
                          isActive && "border-foreground/50 ring-2 ring-foreground/10",
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm leading-relaxed">
                              {applyVariables(hook, valuesByHookId[hook.id] ?? {})}
                            </p>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {platformIconByName[hook.platform]}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{hook.category}</Badge>
                            <Badge variant="outline">{hook.tone}</Badge>
                            <Badge variant="outline">{hook.platform}</Badge>
                            {isActive ? (
                              <Badge variant="outline" className="border-foreground/40">
                                Selected (↑↓ Enter)
                              </Badge>
                            ) : null}
                          </div>

                          {hasVariables ? (
                            <div className="mt-3 rounded-md border border-dashed p-3">
                              <p className="mb-2 text-xs text-muted-foreground">
                                Placeholder hints: {hook.variables?.map((name) => `{${name}}`).join(", ")}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {hook.variables?.map((variable) => (
                                  <Input
                                    key={`${hook.id}-${variable}`}
                                    value={valuesByHookId[hook.id]?.[variable] ?? ""}
                                    onChange={(event) =>
                                      handleValueChange(hook.id, variable, event.target.value)
                                    }
                                    placeholder={`Enter ${variable}`}
                                    className="h-9 text-xs"
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={() => useHook(hook)}>
                              Use This Hook
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => copyHook(hook)}
                            >
                              <Copy className="h-4 w-4" />
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
