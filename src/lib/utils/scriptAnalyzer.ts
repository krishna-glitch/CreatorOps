export const speakingRates = {
  instagram: {
    reel: 150,
    story: 120,
    post: 0,
  },
  youtube: {
    short: 150,
    video: 130,
    long: 120,
  },
  tiktok: {
    video: 160,
  },
} as const;

export const targetDurations = {
  instagram: {
    reel: { min: 15, ideal: 30, max: 90 },
    story: { min: 5, ideal: 10, max: 15 },
  },
  youtube: {
    short: { min: 15, ideal: 45, max: 60 },
    video: { min: 480, ideal: 720, max: 1200 },
  },
  tiktok: {
    video: { min: 15, ideal: 30, max: 180 },
  },
} as const;

export type SuggestionStatus = "perfect" | "too_long" | "too_short";
export type FeedbackColor = "green" | "yellow" | "red";

export type SuggestionResult = {
  suggestion: string;
  status: SuggestionStatus;
  color: FeedbackColor;
};

export type DurationEstimate = {
  wordCount: number;
  characterCount: number;
  estimatedSeconds: number;
  suggestion: string;
  status: SuggestionStatus;
};

const DEFAULT_WORDS_PER_MINUTE = 130;
const WORD_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "word" })
    : null;
const GRAPHEME_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

const STATUS_COLORS: Record<SuggestionStatus, FeedbackColor> = {
  perfect: "green",
  too_long: "red",
  too_short: "red",
};

function stripHtml(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function toKey(value: string): string {
  return value.toLowerCase().trim();
}

function toTitle(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getSpeakingRate(platform: string, contentType: string): number {
  const platformKey = toKey(platform) as keyof typeof speakingRates;
  const contentKey = toKey(contentType);

  const platformRates = speakingRates[platformKey] as
    | Record<string, number>
    | undefined;

  if (platformRates && contentKey in platformRates) {
    return platformRates[contentKey] ?? DEFAULT_WORDS_PER_MINUTE;
  }

  return DEFAULT_WORDS_PER_MINUTE;
}

function getTargetSpec(platform: string, contentType: string) {
  const platformKey = toKey(platform) as keyof typeof targetDurations;
  const contentKey = toKey(contentType);

  const platformTargets = targetDurations[platformKey] as
    | Record<string, { min: number; ideal: number; max: number }>
    | undefined;

  if (platformTargets && contentKey in platformTargets) {
    return platformTargets[contentKey];
  }

  return null;
}

export function countWords(text: string): number {
  const stripped = stripHtml(text);
  if (!stripped) return 0;

  if (WORD_SEGMENTER) {
    let count = 0;
    for (const token of WORD_SEGMENTER.segment(stripped)) {
      if (token.isWordLike) count += 1;
    }
    return count;
  }

  return stripped.split(/\s+/).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
}

export function countCharacters(text: string): number {
  const stripped = stripHtml(text);
  if (!stripped) return 0;

  if (GRAPHEME_SEGMENTER) {
    let count = 0;
    for (const _ of GRAPHEME_SEGMENTER.segment(stripped)) {
      count += 1;
    }
    return count;
  }

  return Array.from(stripped).length;
}

export function getSuggestions(
  wordCount: number,
  duration: number,
  target: number,
): SuggestionResult {
  if (target <= 0) {
    return {
      suggestion: "Perfect length! ✓",
      status: "perfect",
      color: "green",
    };
  }

  const deltaSeconds = duration - target;
  const toleranceSeconds = Math.max(3, Math.round(target * 0.1));

  if (Math.abs(deltaSeconds) <= toleranceSeconds) {
    return {
      suggestion: "Perfect length! ✓",
      status: "perfect",
      color: "green",
    };
  }

  const wordsPerSecond = duration > 0 ? wordCount / duration : DEFAULT_WORDS_PER_MINUTE / 60;

  if (deltaSeconds > 0) {
    const wordsOver = Math.max(1, Math.round(deltaSeconds * wordsPerSecond));
    return {
      suggestion: `Too long by ${wordsOver} words. Cut ~${Math.round(deltaSeconds)} seconds`,
      status: "too_long",
      color: STATUS_COLORS.too_long,
    };
  }

  const secondsShort = Math.abs(deltaSeconds);
  const wordsNeeded = Math.max(1, Math.round(secondsShort * wordsPerSecond));
  return {
    suggestion: `Too short. Add ~${wordsNeeded} words for ${Math.round(target)}s`,
    status: "too_short",
    color: STATUS_COLORS.too_short,
  };
}

export function estimateDuration(
  text: string,
  platform: string,
  contentType: string,
): DurationEstimate {
  const wordCount = countWords(text);
  const characterCount = countCharacters(text);
  const wordsPerMinute = getSpeakingRate(platform, contentType);

  const estimatedSeconds =
    wordsPerMinute > 0 ? Math.round((wordCount / wordsPerMinute) * 60) : 0;

  const target = getTargetSpec(platform, contentType);

  if (!target) {
    const fallback = getSuggestions(wordCount, estimatedSeconds, 0);
    return {
      wordCount,
      characterCount,
      estimatedSeconds,
      suggestion: fallback.suggestion,
      status: fallback.status,
    };
  }

  const baseSuggestion = getSuggestions(wordCount, estimatedSeconds, target.ideal);
  const platformLabel = `${toTitle(toKey(platform))} ${toTitle(toKey(contentType))}`;

  let status: SuggestionStatus = baseSuggestion.status;
  let suggestion = baseSuggestion.suggestion;

  if (estimatedSeconds > target.max) {
    status = "too_long";
    const overBy = estimatedSeconds - target.max;
    suggestion = `${suggestion} Too long for ${platformLabel} by ~${overBy}s (max ${target.max}s).`;
  } else if (estimatedSeconds < target.min && wordsPerMinute > 0) {
    status = "too_short";
    const shortBy = target.min - estimatedSeconds;
    const wordsToAdd = Math.max(1, Math.round((shortBy / 60) * wordsPerMinute));
    suggestion = `${suggestion} Add ~${wordsToAdd} words to hit minimum ${target.min}s.`;
  } else if (Math.abs(estimatedSeconds - target.ideal) <= Math.max(2, target.ideal * 0.12)) {
    status = "perfect";
    suggestion = `${suggestion} Great for ${platformLabel} (${target.ideal}s).`;
  } else {
    suggestion = `${suggestion} Within ${platformLabel} range (${target.min}-${target.max}s).`;
  }

  return {
    wordCount,
    characterCount,
    estimatedSeconds,
    suggestion,
    status,
  };
}
