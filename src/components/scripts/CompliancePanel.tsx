"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [isValidating, setIsValidating] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSavedAt, setRulesSavedAt] = useState<Date | null>(null);
  const [showRulesForm, setShowRulesForm] = useState(true);
  const [showPassedChecks, setShowPassedChecks] = useState(false);

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
    <Card className={cn("border bg-card text-card-foreground", className)}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Compliance Checker</p>
            <p className="text-xs text-muted-foreground">{status.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", status.className)}
            >
              <status.Icon className="mr-1 h-3.5 w-3.5" />
              {status.label}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fixAll}
              disabled={fixableCount === 0}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Fix All
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-background p-3">
          <button
            type="button"
            onClick={() => setShowRulesForm((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-medium">Brand Rules</p>
              <p className="text-xs text-muted-foreground">
                Edit rules and save them per brand.
              </p>
            </div>
            {showRulesForm ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showRulesForm ? (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">
                  Required phrases (comma-separated)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftRequiredPhrases}
                    onChange={(event) =>
                      setDraftRequiredPhrases(event.target.value)
                    }
                    placeholder="Use code SAVE15, Limited time offer"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addListItems("required_phrases")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(rules.required_phrases ?? []).map((phrase) => (
                    <button
                      type="button"
                      key={phrase}
                      onClick={() => removeListItem("required_phrases", phrase)}
                      className="rounded-full border border-gray-200 bg-background px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {phrase} ×
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Forbidden words (comma-separated)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftForbiddenWords}
                    onChange={(event) =>
                      setDraftForbiddenWords(event.target.value)
                    }
                    placeholder="cheap, guaranteed"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addListItems("forbidden_words")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(rules.forbidden_words ?? []).map((word) => (
                    <button
                      type="button"
                      key={word}
                      onClick={() => removeListItem("forbidden_words", word)}
                      className="rounded-full border border-gray-200 bg-background px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {word} ×
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Required hashtags (comma-separated)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={draftRequiredHashtags}
                    onChange={(event) =>
                      setDraftRequiredHashtags(event.target.value)
                    }
                    placeholder="#creatorops, #ad"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addListItems("required_hashtags")}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(rules.required_hashtags ?? []).map((hashtag) => (
                    <button
                      type="button"
                      key={hashtag}
                      onClick={() =>
                        removeListItem("required_hashtags", hashtag)
                      }
                      className="rounded-full border border-gray-200 bg-background px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {hashtag} ×
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min words</Label>
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
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max words</Label>
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
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max hashtags</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rules.max_hashtags ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setRules((prev) => ({
                        ...prev,
                        max_hashtags: value ? Number(value) : undefined,
                      }));
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(rules.must_tag_brand)}
                    onChange={(event) => {
                      setRules((prev) => ({
                        ...prev,
                        must_tag_brand: event.target.checked,
                      }));
                    }}
                  />
                  Must tag brand handle
                </label>

                <Input
                  value={rules.brand_handle ?? ""}
                  onChange={(event) => {
                    setRules((prev) => ({
                      ...prev,
                      brand_handle: event.target.value,
                    }));
                  }}
                  placeholder="@nike"
                  className="h-9 max-w-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveRules()}
                  loading={savingRules}
                  disabled={!onSaveRules || !brandId}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Rules
                </Button>
                {brandId ? (
                  <p className="text-xs text-muted-foreground">
                    {rulesSavedAt
                      ? `Saved at ${rulesSavedAt.toLocaleTimeString()}`
                      : "Rules will be saved to this brand."}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pass `brandId` to enable rule persistence.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Issues</p>
            {isValidating ? (
              <p className="text-xs text-muted-foreground">Validating...</p>
            ) : null}
          </div>

          {validationResult.issues.length === 0 ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
              No compliance issues found.
            </div>
          ) : (
            <div className="space-y-2">
              {(Object.keys(groupedIssues) as IssueType[]).map((issueType) => {
                const issues = groupedIssues[issueType];
                if (issues.length === 0) return null;

                return (
                  <details key={issueType} open>
                    <summary className="cursor-pointer list-none rounded-md border bg-background px-3 py-2 text-sm font-medium">
                      <div className="flex items-center justify-between gap-2">
                        <span>{ISSUE_TYPE_LABEL[issueType]}</span>
                        <Badge variant="outline" className="text-xs">
                          {issues.length}
                        </Badge>
                      </div>
                    </summary>
                    <div className="mt-2 space-y-2 px-1">
                      {issues.map((issue, index) => (
                        <div
                          key={`${issue.type}-${index}`}
                          className="rounded-md border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {issue.severity === "error" ? "❌" : "⚠️"}{" "}
                                {issue.message}
                              </p>
                              {issue.suggestion ? (
                                <p className="text-xs text-muted-foreground">
                                  Suggestion: {issue.suggestion}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applySingleFix(issue)}
                              disabled={!issue.suggestion}
                            >
                              Fix
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border bg-background p-3">
          <button
            type="button"
            onClick={() => setShowPassedChecks((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="text-sm font-medium">
              Passed Checks ({validationResult.passed.length})
            </p>
            {showPassedChecks ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showPassedChecks ? (
            <div className="space-y-1">
              {validationResult.passed.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No checks passed yet.
                </p>
              ) : (
                validationResult.passed.map((item) => (
                  <p
                    key={item}
                    className="flex items-center gap-2 text-xs text-emerald-700"
                  >
                    <CircleCheck className="h-3.5 w-3.5" />
                    {item}
                  </p>
                ))
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export type { BrandRules, ComplianceHighlight };
