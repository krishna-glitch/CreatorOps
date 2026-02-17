"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type BrandRules,
  type ComplianceIssue,
  checkCompliance,
} from "@/src/lib/utils/complianceChecker";

type ComplianceHighlight = {
  type: "forbidden_word" | "missing_required";
  value: string;
  severity: "error" | "warning";
  // Optional range for editor decorators.
  start?: number;
  end?: number;
};

type CompliancePanelProps = {
  script: string;
  onScriptChange: (nextScript: string) => void;
  brandId?: string;
  initialRules?: BrandRules;
  onSaveRules?: (input: {
    brandId: string;
    rules: BrandRules;
  }) => Promise<void> | void;
  onHighlightsChange?: (highlights: ComplianceHighlight[]) => void;
  className?: string;
};

type IssueType = ComplianceIssue["type"];

const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  missing_required: "Missing Required Phrases",
  forbidden_word: "Forbidden Words",
  missing_hashtag: "Hashtag Issues",
  missing_tag: "Brand Tag Issues",
  word_count: "Word Count",
};

function parseListInput(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readQuotedText(input: string): string | null {
  const match = input.match(/"([^"]+)"/);
  return match?.[1] ?? null;
}

function normalizeHashtag(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

function normalizeHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function appendTokenIfMissing(base: string, token: string): string {
  if (base.toLowerCase().includes(token.toLowerCase())) {
    return base;
  }

  const trimmed = base.trimEnd();
  if (!trimmed) return token;

  return `${trimmed}${trimmed.endsWith("\n") ? "" : "\n"}${token}`;
}

function replaceFirstWord(
  source: string,
  target: string,
  replacement: string,
): string {
  if (!target) return source;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`\\b${escaped}\\b`, "i");
  return source.replace(matcher, replacement);
}

function applyIssueSuggestion(script: string, issue: ComplianceIssue): string {
  if (!issue.suggestion) {
    return script;
  }

  if (issue.type === "missing_required") {
    const phrase = readQuotedText(issue.message);
    return phrase ? appendTokenIfMissing(script, phrase) : script;
  }

  if (issue.type === "missing_hashtag") {
    const tag = readQuotedText(issue.message);
    return tag ? appendTokenIfMissing(script, normalizeHashtag(tag)) : script;
  }

  if (issue.type === "missing_tag") {
    const handleMatch = issue.message.match(/@([a-zA-Z0-9_.]+)/);
    const handle = handleMatch?.[0] ?? null;
    return handle
      ? appendTokenIfMissing(script, normalizeHandle(handle))
      : script;
  }

  if (issue.type === "forbidden_word") {
    const forbidden = readQuotedText(issue.message);
    const replacements = Array.from(
      issue.suggestion.matchAll(/"([^"]+)"/g),
    ).map((m) => m[1]);
    const replacement = replacements[1] ?? "approved";

    if (!forbidden) {
      return script;
    }

    return replaceFirstWord(script, forbidden, replacement);
  }

  return script;
}

function buildHighlights(
  script: string,
  rules: BrandRules,
  issues: ComplianceIssue[],
): ComplianceHighlight[] {
  const highlights: ComplianceHighlight[] = [];

  for (const issue of issues) {
    if (issue.type === "forbidden_word") {
      const forbiddenWord = readQuotedText(issue.message);
      if (!forbiddenWord) continue;

      const matcher = new RegExp(
        forbiddenWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "ig",
      );
      const match = matcher.exec(script);

      if (match) {
        highlights.push({
          type: "forbidden_word",
          value: forbiddenWord,
          severity: issue.severity,
          start: match.index,
          end: match.index + forbiddenWord.length,
        });
      } else {
        highlights.push({
          type: "forbidden_word",
          value: forbiddenWord,
          severity: issue.severity,
        });
      }
    }

    if (issue.type === "missing_required") {
      const phrase = readQuotedText(issue.message);
      if (!phrase) continue;
      highlights.push({
        type: "missing_required",
        value: phrase,
        severity: issue.severity,
      });
    }
  }

  for (const phrase of rules.required_phrases ?? []) {
    if (phrase.trim() && !script.toLowerCase().includes(phrase.toLowerCase())) {
      highlights.push({
        type: "missing_required",
        value: phrase,
        severity: "error",
      });
    }
  }

  return highlights;
}

function getStatus(issues: ComplianceIssue[]) {
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const hasWarnings = issues.some((issue) => issue.severity === "warning");

  if (hasErrors) {
    return {
      key: "error" as const,
      label: "❌ Errors",
      className: "border-rose-300 bg-rose-100 text-rose-700",
      Icon: XCircle,
      summary: "Script has blocking compliance errors.",
    };
  }

  if (hasWarnings) {
    return {
      key: "warning" as const,
      label: "⚠️ Issues",
      className: "border-amber-300 bg-amber-100 text-amber-700",
      Icon: AlertTriangle,
      summary: "Script is mostly compliant but has warnings.",
    };
  }

  return {
    key: "success" as const,
    label: "✓ Compliant",
    className: "border-emerald-300 bg-emerald-100 text-emerald-700",
    Icon: CheckCircle2,
    summary: "Script meets all active brand requirements.",
  };
}

export function CompliancePanel({
  brandId,
  className,
  initialRules,
  onHighlightsChange,
  onSaveRules,
  onScriptChange,
  script,
}: CompliancePanelProps) {
  const [rules, setRules] = useState<BrandRules>(
    initialRules ?? {
      required_phrases: [],
      forbidden_words: [],
      required_hashtags: [],
      min_word_count: undefined,
      max_word_count: undefined,
      max_hashtags: undefined,
      must_tag_brand: false,
      brand_handle: "",
      tone_guidelines: "",
    },
  );
  const [draftRequiredPhrases, setDraftRequiredPhrases] = useState("");
  const [draftForbiddenWords, setDraftForbiddenWords] = useState("");
  const [draftRequiredHashtags, setDraftRequiredHashtags] = useState("");
  const [validationResult, setValidationResult] = useState(() =>
    checkCompliance(script, initialRules ?? {}),
  );
  const [_isValidating, setIsValidating] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSavedAt, setRulesSavedAt] = useState<Date | null>(null);
  const [showRulesForm, setShowRulesForm] = useState(true);
  const [_showPassedChecks, _setShowPassedChecks] = useState(false);

  useEffect(() => {
    setRules((prev) => ({ ...prev, ...(initialRules ?? {}) }));
  }, [initialRules]);

  useEffect(() => {
    setIsValidating(true);

    const timeoutId = window.setTimeout(() => {
      setValidationResult(checkCompliance(script, rules));
      setIsValidating(false);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [script, rules]);

  useEffect(() => {
    if (!onHighlightsChange) return;
    onHighlightsChange(buildHighlights(script, rules, validationResult.issues));
  }, [onHighlightsChange, rules, script, validationResult.issues]);

  const groupedIssues = useMemo(() => {
    return validationResult.issues.reduce<Record<IssueType, ComplianceIssue[]>>(
      (accumulator, issue) => {
        accumulator[issue.type].push(issue);
        return accumulator;
      },
      {
        missing_required: [],
        forbidden_word: [],
        missing_hashtag: [],
        missing_tag: [],
        word_count: [],
      },
    );
  }, [validationResult.issues]);

  const status = getStatus(validationResult.issues);

  async function saveRules() {
    if (!onSaveRules || !brandId) return;

    try {
      setSavingRules(true);
      await onSaveRules({ brandId, rules });
      setRulesSavedAt(new Date());
    } finally {
      setSavingRules(false);
    }
  }

  function addListItems(
    type: "required_phrases" | "forbidden_words" | "required_hashtags",
  ) {
    if (type === "required_phrases") {
      const additions = parseListInput(draftRequiredPhrases);
      if (additions.length === 0) return;
      setRules((prev) => ({
        ...prev,
        required_phrases: Array.from(
          new Set([...(prev.required_phrases ?? []), ...additions]),
        ),
      }));
      setDraftRequiredPhrases("");
      return;
    }

    if (type === "forbidden_words") {
      const additions = parseListInput(draftForbiddenWords);
      if (additions.length === 0) return;
      setRules((prev) => ({
        ...prev,
        forbidden_words: Array.from(
          new Set([...(prev.forbidden_words ?? []), ...additions]),
        ),
      }));
      setDraftForbiddenWords("");
      return;
    }

    const additions = parseListInput(draftRequiredHashtags).map(
      normalizeHashtag,
    );
    if (additions.length === 0) return;
    setRules((prev) => ({
      ...prev,
      required_hashtags: Array.from(
        new Set([...(prev.required_hashtags ?? []), ...additions]),
      ),
    }));
    setDraftRequiredHashtags("");
  }

  function removeListItem(
    type: "required_phrases" | "forbidden_words" | "required_hashtags",
    item: string,
  ) {
    setRules((prev) => ({
      ...prev,
      [type]: (prev[type] ?? []).filter((value) => value !== item),
    }));
  }

  function applySingleFix(issue: ComplianceIssue) {
    const nextScript = applyIssueSuggestion(script, issue);
    if (nextScript !== script) {
      onScriptChange(nextScript);
    }
  }

  function fixAll() {
    const fixableIssues = validationResult.issues.filter(
      (issue) => issue.suggestion,
    );
    if (fixableIssues.length === 0) return;

    const nextScript = fixableIssues.reduce((accumulator, issue) => {
      return applyIssueSuggestion(accumulator, issue);
    }, script);

    if (nextScript !== script) {
      onScriptChange(nextScript);
    }
  }

  const fixableCount = validationResult.issues.filter(
    (issue) => issue.suggestion,
  ).length;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-xl border dash-border dash-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border dash-bg-card",
                status.key === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : status.key === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-600",
              )}
            >
              <status.Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {status.label}
              </p>
              <p className="text-[10px] text-slate-500">{status.summary}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={fixAll}
            disabled={fixableCount === 0}
            className="h-8 text-xs"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
            Fix All ({fixableCount})
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {validationResult.issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">
                Script is fully compliant with brand rules.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {(Object.keys(groupedIssues) as IssueType[]).map((issueType) => {
                const issues = groupedIssues[issueType];
                if (issues.length === 0) return null;

                return (
                  <div
                    key={issueType}
                    className="overflow-hidden rounded-lg border dash-border dash-bg-card"
                  >
                    <div className="flex items-center justify-between border-b dash-border dash-bg-card px-3 py-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {ISSUE_TYPE_LABEL[issueType]}
                      </span>
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px] font-medium text-slate-600"
                      >
                        {issues.length}
                      </Badge>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {issues.map((issue, index) => (
                        <div
                          key={`${issue.type}-${index}`}
                          className="flex items-start justify-between gap-3 p-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {issue.severity === "error" ? (
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              <span className="text-xs font-medium text-slate-900">
                                {issue.message}
                              </span>
                            </div>
                            {issue.suggestion && (
                              <p className="ml-5 text-[10px] text-slate-500">
                                Try:{" "}
                                <span className="font-medium text-slate-700">
                                  "{issue.suggestion}"
                                </span>
                              </p>
                            )}
                          </div>
                          {issue.suggestion && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] hover:bg-indigo-50 hover:text-indigo-600"
                              onClick={() => applySingleFix(issue)}
                            >
                              Fix
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border dash-border dash-bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setShowRulesForm((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left dash-bg-card"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md dash-bg-card text-slate-500">
              <Save className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Brand Rules
              </p>
              <p className="text-[10px] text-slate-500">
                Configure requirements for this script
              </p>
            </div>
          </div>
          {showRulesForm ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showRulesForm && (
          <div className="border-t border-slate-100 p-3 pt-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">
                  Required phrases
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftRequiredPhrases}
                    onChange={(event) =>
                      setDraftRequiredPhrases(event.target.value)
                    }
                    placeholder="e.g. Save 20%, Link in bio"
                    className="h-8 text-xs"
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addListItems("required_phrases"))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => addListItems("required_phrases")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(rules.required_phrases ?? []).map((phrase) => (
                    <button
                      type="button"
                      key={phrase}
                      onClick={() => removeListItem("required_phrases", phrase)}
                      className="inline-flex items-center gap-1 rounded-md border dash-border dash-bg-card px-2 py-1 text-[10px] font-medium text-slate-700 dash-bg-card"
                    >
                      {phrase} <span className="text-slate-400">×</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">
                  Forbidden words
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftForbiddenWords}
                    onChange={(event) =>
                      setDraftForbiddenWords(event.target.value)
                    }
                    placeholder="e.g. cheap, guarantee"
                    className="h-8 text-xs"
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addListItems("forbidden_words"))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => addListItems("forbidden_words")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(rules.forbidden_words ?? []).map((word) => (
                    <button
                      type="button"
                      key={word}
                      onClick={() => removeListItem("forbidden_words", word)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-100"
                    >
                      {word} <span className="text-rose-400">×</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">
                  Required hashtags
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftRequiredHashtags}
                    onChange={(event) =>
                      setDraftRequiredHashtags(event.target.value)
                    }
                    placeholder="e.g. #ad, #sponsored"
                    className="h-8 text-xs"
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addListItems("required_hashtags"))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => addListItems("required_hashtags")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(rules.required_hashtags ?? []).map((hashtag) => (
                    <button
                      type="button"
                      key={hashtag}
                      onClick={() =>
                        removeListItem("required_hashtags", hashtag)
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {hashtag} <span className="text-blue-400">×</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    Min words
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={rules.min_word_count ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setRules((prev) => ({
                        ...prev,
                        min_word_count: value ? Number(value) : undefined,
                      }));
                    }}
                    className="h-8 text-xs"
                    placeholder="None"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    Max words
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={rules.max_word_count ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setRules((prev) => ({
                        ...prev,
                        max_word_count: value ? Number(value) : undefined,
                      }));
                    }}
                    className="h-8 text-xs"
                    placeholder="None"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dash-bg-card p-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded dash-border text-slate-900 focus:ring-slate-900"
                    checked={Boolean(rules.must_tag_brand)}
                    onChange={(event) => {
                      setRules((prev) => ({
                        ...prev,
                        must_tag_brand: event.target.checked,
                      }));
                    }}
                  />
                  Tag brand
                </label>

                <Input
                  value={rules.brand_handle ?? ""}
                  onChange={(event) => {
                    setRules((prev) => ({
                      ...prev,
                      brand_handle: event.target.value,
                    }));
                  }}
                  placeholder="@handle"
                  className="h-7 w-32 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {brandId ? (
                  <span className="text-[10px] text-slate-400">
                    {rulesSavedAt
                      ? `Saved ${rulesSavedAt.toLocaleTimeString()}`
                      : "Unsaved changes"}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    Local only (no brand connected)
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveRules()}
                  loading={savingRules}
                  disabled={!onSaveRules || !brandId}
                  className="h-7 text-xs dash-bg-panel text-white dash-bg-panel"
                >
                  Save Rules
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { BrandRules, ComplianceHighlight };
