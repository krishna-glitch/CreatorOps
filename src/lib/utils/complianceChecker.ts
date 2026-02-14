import { countWords } from "./scriptAnalyzer";

export interface BrandRules {
  required_phrases?: string[];
  forbidden_words?: string[];
  required_hashtags?: string[];
  max_hashtags?: number;
  must_tag_brand?: boolean;
  brand_handle?: string;
  tone_guidelines?: string;
  min_word_count?: number;
  max_word_count?: number;
}

export interface ComplianceIssue {
  type:
    | "missing_required"
    | "forbidden_word"
    | "missing_hashtag"
    | "missing_tag"
    | "word_count";
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermMatcher(term: string): RegExp {
  const normalized = term.trim().replace(/\s+/g, "\\s+");
  const escaped = escapeRegex(normalized).replace(/\\\\s\+/g, "\\s+");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
    "iu",
  );
}

function getHashtags(script: string): string[] {
  const matches = script.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return matches.map((tag) => normalize(tag));
}

function normalizeHashtag(tag: string): string {
  const trimmed = normalize(tag);
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function normalizeHandle(handle: string): string {
  const trimmed = normalize(handle);
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function checkCompliance(
  script: string,
  rules: BrandRules,
): {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  warnings: ComplianceIssue[];
  passed: string[];
} {
  const source = script ?? "";
  const normalizedScript = source.toLowerCase();
  const issues: ComplianceIssue[] = [];
  const passed: string[] = [];

  const requiredPhrases = (rules.required_phrases ?? [])
    .map((phrase) => phrase.trim())
    .filter(Boolean);

  if (requiredPhrases.length > 0) {
    let missingPhraseCount = 0;
    for (const phrase of requiredPhrases) {
      if (!normalizedScript.includes(phrase.toLowerCase())) {
        missingPhraseCount += 1;
        issues.push({
          type: "missing_required",
          severity: "error",
          message: `Missing required phrase: "${phrase}".`,
          suggestion: `Add "${phrase}" to your CTA or key message.`,
        });
      }
    }

    if (missingPhraseCount === 0) {
      passed.push("All required phrases are present.");
    }
  }

  const forbiddenWords = (rules.forbidden_words ?? [])
    .map((word) => word.trim())
    .filter(Boolean);

  if (forbiddenWords.length > 0) {
    let forbiddenFound = 0;

    for (const forbiddenWord of forbiddenWords) {
      const matcher = buildTermMatcher(forbiddenWord);
      if (matcher.test(source)) {
        forbiddenFound += 1;
        issues.push({
          type: "forbidden_word",
          severity: "error",
          message: `Found forbidden word: "${forbiddenWord}".`,
          suggestion: `Replace "${forbiddenWord}" with brand-safe wording (e.g., "affordable").`,
        });
      }
    }

    if (forbiddenFound === 0) {
      passed.push("No forbidden words found.");
    }
  }

  const requiredHashtags = (rules.required_hashtags ?? [])
    .map(normalizeHashtag)
    .filter(Boolean);
  const hashtagsInScript = getHashtags(source);
  const hashtagSet = new Set(hashtagsInScript);

  if (requiredHashtags.length > 0) {
    let missingHashtagCount = 0;

    for (const requiredHashtag of requiredHashtags) {
      if (!hashtagSet.has(requiredHashtag)) {
        missingHashtagCount += 1;
        issues.push({
          type: "missing_hashtag",
          severity: "error",
          message: `Missing required hashtag: "${requiredHashtag}".`,
          suggestion: `Add ${requiredHashtag} to your caption hashtags.`,
        });
      }
    }

    if (missingHashtagCount === 0) {
      passed.push("All required hashtags are present.");
    }
  }

  if (typeof rules.max_hashtags === "number") {
    if (hashtagsInScript.length > rules.max_hashtags) {
      issues.push({
        type: "missing_hashtag",
        severity: "warning",
        message: `Hashtag count is ${hashtagsInScript.length}, above the limit of ${rules.max_hashtags}.`,
        suggestion: `Remove ${hashtagsInScript.length - rules.max_hashtags} hashtag(s) to meet the limit.`,
      });
    } else {
      passed.push(
        `Hashtag count is within the limit (${hashtagsInScript.length}/${rules.max_hashtags}).`,
      );
    }
  }

  if (rules.must_tag_brand) {
    const brandHandle = normalizeHandle(rules.brand_handle ?? "");

    if (!brandHandle || !normalizedScript.includes(brandHandle)) {
      const handleToShow = brandHandle || "@brand";
      issues.push({
        type: "missing_tag",
        severity: "error",
        message: `Missing brand tag ${handleToShow}.`,
        suggestion: `Add ${handleToShow} to the caption.`,
      });
    } else {
      passed.push(`Brand handle ${brandHandle} is tagged.`);
    }
  }

  const wordCount = countWords(source);
  const minWordCount = rules.min_word_count;
  const maxWordCount = rules.max_word_count;

  if (typeof minWordCount === "number" && wordCount < minWordCount) {
    issues.push({
      type: "word_count",
      severity: "error",
      message: `Word count is ${wordCount}, below the minimum of ${minWordCount}.`,
      suggestion: `Add at least ${minWordCount - wordCount} more word(s).`,
    });
  }

  if (typeof maxWordCount === "number" && wordCount > maxWordCount) {
    issues.push({
      type: "word_count",
      severity: "error",
      message: `Word count is ${wordCount}, above the maximum of ${maxWordCount}.`,
      suggestion: `Remove at least ${wordCount - maxWordCount} word(s).`,
    });
  }

  if (
    (typeof minWordCount !== "number" || wordCount >= minWordCount) &&
    (typeof maxWordCount !== "number" || wordCount <= maxWordCount)
  ) {
    if (typeof minWordCount === "number" || typeof maxWordCount === "number") {
      const minLabel =
        typeof minWordCount === "number" ? `${minWordCount}` : "-";
      const maxLabel =
        typeof maxWordCount === "number" ? `${maxWordCount}` : "-";
      passed.push(
        `Word count is within range (${wordCount}; min ${minLabel}, max ${maxLabel}).`,
      );
    }
  }

  const warnings = issues.filter((issue) => issue.severity === "warning");
  const isCompliant = issues.every((issue) => issue.severity !== "error");

  return {
    isCompliant,
    issues,
    warnings,
    passed,
  };
}
