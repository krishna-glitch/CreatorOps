import { syllable } from "syllable";

export interface ReadabilityResult {
  score: number;
  level: "Very Easy" | "Easy" | "Standard" | "Difficult" | "Very Difficult";
  grade: number;
}

export interface SentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  positiveWords: string[];
  negativeWords: string[];
}

export interface KeywordDensityItem {
  word: string;
  count: number;
  percentage: number;
}

export interface CTAResult {
  hasCallToAction: boolean;
  ctaType: "link" | "engagement" | "purchase" | "subscribe" | null;
  ctaText?: string;
}

export interface EngagementResult {
  score: number;
  factors: {
    hasQuestions: boolean;
    questionCount: number;
    emojiCount: number;
    hasCallToAction: boolean;
    personalPronouns: number;
  };
}

export interface ScriptMetrics {
  readability: {
    score: number;
    level: string;
    grade: number;
  };
  sentiment: {
    sentiment: "positive" | "neutral" | "negative";
    score: number;
  };
  keywords: { word: string; count: number; percentage: number }[];
  cta: {
    hasCallToAction: boolean;
    ctaType: string | null;
  };
  engagement: {
    score: number;
    factors: {
      hasQuestions: boolean;
      questionCount: number;
      emojiCount: number;
      hasCallToAction: boolean;
      personalPronouns: number;
    };
  };
  basic: {
    words: number;
    characters: number;
    sentences: number;
    avgSentenceLength: number;
    emojis: number;
    hashtags: number;
    mentions: number;
    links: number;
  };
}

const WORD_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "word" })
    : null;

const GRAPHEME_SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

const POSITIVE_WORDS = new Set([
  "amazing",
  "awesome",
  "best",
  "brilliant",
  "excellent",
  "fantastic",
  "good",
  "great",
  "happy",
  "helpful",
  "incredible",
  "love",
  "perfect",
  "positive",
  "smart",
  "strong",
  "super",
  "valuable",
  "win",
  "wonderful",
]);

const NEGATIVE_WORDS = new Set([
  "awful",
  "bad",
  "boring",
  "confusing",
  "disappointing",
  "hate",
  "horrible",
  "poor",
  "terrible",
  "ugly",
  "useless",
  "weak",
  "worst",
  "wrong",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "ours",
  "she",
  "so",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "there",
  "they",
  "this",
  "to",
  "too",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "you",
  "your",
  "yours",
]);

const CTA_PATTERNS = {
  purchase: /\b(buy|shop|order|checkout|cart|purchase|code|coupon|discount)\b/i,
  subscribe: /\b(subscribe|sub|join|sign\s?up|newsletter)\b/i,
  link: /\b(link|bio|website|url|click|tap|visit|description)\b/i,
  engagement: /\b(follow|comment|like|share|save|tag|dm|message)\b/i,
};

const PRONOUN_PATTERN = /\b(you|your|yours|u)\b/gi;
const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const SENTENCE_PATTERN = /[^.!?]+(?:[.!?]+|$)/g;
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const MENTION_PATTERN = /@[\p{L}\p{N}_.]+/gu;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stripHtml(text: string): string {
  return (text ?? "")
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

function getWords(text: string): string[] {
  const normalized = text.toLowerCase();
  return normalized.match(WORD_PATTERN) ?? [];
}

function countWords(text: string): number {
  if (!text) return 0;

  if (WORD_SEGMENTER) {
    let count = 0;
    for (const token of WORD_SEGMENTER.segment(text)) {
      if (token.isWordLike) count += 1;
    }
    return count;
  }

  return getWords(text).length;
}

function countCharacters(text: string): number {
  if (!text) return 0;

  if (GRAPHEME_SEGMENTER) {
    let count = 0;
    for (const _ of GRAPHEME_SEGMENTER.segment(text)) {
      count += 1;
    }
    return count;
  }

  return Array.from(text).length;
}

function splitSentences(text: string): string[] {
  return (text.match(SENTENCE_PATTERN) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);
}

function countSyllables(words: string[]): number {
  return words.reduce((total, word) => total + Math.max(1, syllable(word)), 0);
}

function scoreToLevel(score: number): ReadabilityResult["level"] {
  if (score >= 90) return "Very Easy";
  if (score >= 80) return "Easy";
  if (score >= 60) return "Standard";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}

export function calculateReadability(text: string): ReadabilityResult {
  const cleaned = stripHtml(text);
  const words = getWords(cleaned);
  const sentences = splitSentences(cleaned);

  const totalWords = words.length || 1;
  const totalSentences = sentences.length || 1;
  const totalSyllables = countSyllables(words);

  const score =
    206.835 -
    1.015 * (totalWords / totalSentences) -
    84.6 * (totalSyllables / totalWords);

  const grade =
    0.39 * (totalWords / totalSentences) +
    11.8 * (totalSyllables / totalWords) -
    15.59;

  const normalizedScore = Number(clamp(score, 0, 100).toFixed(2));
  const normalizedGrade = Number(Math.max(0, grade).toFixed(1));

  return {
    score: normalizedScore,
    level: scoreToLevel(normalizedScore),
    grade: normalizedGrade,
  };
}

export function analyzeSentiment(text: string): SentimentResult {
  const cleaned = stripHtml(text);
  const words = getWords(cleaned);
  let positiveCount = 0;
  let negativeCount = 0;
  const positiveMatched = new Set<string>();
  const negativeMatched = new Set<string>();

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) {
      positiveCount += 1;
      positiveMatched.add(word);
    }
    if (NEGATIVE_WORDS.has(word)) {
      negativeCount += 1;
      negativeMatched.add(word);
    }
  }

  const totalMatched = positiveCount + negativeCount;
  const rawScore =
    totalMatched > 0 ? (positiveCount - negativeCount) / totalMatched : 0;
  const score = Number(clamp(rawScore, -1, 1).toFixed(3));

  let sentiment: SentimentResult["sentiment"] = "neutral";
  if (score > 0.1) sentiment = "positive";
  if (score < -0.1) sentiment = "negative";

  return {
    sentiment,
    score,
    positiveWords: [...positiveMatched],
    negativeWords: [...negativeMatched],
  };
}

export function getKeywordDensity(text: string): KeywordDensityItem[] {
  const cleaned = stripHtml(text);
  const words = getWords(cleaned).filter(
    (word) => !STOP_WORDS.has(word) && word.length > 1,
  );
  const total = words.length || 1;
  const frequency = new Map<string, number>();

  for (const word of words) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .map(([word, count]) => ({
      word,
      count,
      percentage: Number(((count / total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 20);
}

function findCtaText(cleanedText: string): string | undefined {
  const sentences = splitSentences(cleanedText);
  return sentences.find((sentence) =>
    /(buy|shop|order|checkout|subscribe|link|bio|follow|comment|like|share|save|code)/i.test(
      sentence,
    ),
  );
}

export function detectCTA(text: string): CTAResult {
  const cleaned = stripHtml(text);
  const ctaText = findCtaText(cleaned);

  if (CTA_PATTERNS.purchase.test(cleaned)) {
    return { hasCallToAction: true, ctaType: "purchase", ctaText };
  }
  if (CTA_PATTERNS.subscribe.test(cleaned)) {
    return { hasCallToAction: true, ctaType: "subscribe", ctaText };
  }
  if (CTA_PATTERNS.link.test(cleaned)) {
    return { hasCallToAction: true, ctaType: "link", ctaText };
  }
  if (CTA_PATTERNS.engagement.test(cleaned)) {
    return { hasCallToAction: true, ctaType: "engagement", ctaText };
  }

  return { hasCallToAction: false, ctaType: null };
}

export function calculateEngagement(text: string): EngagementResult {
  const cleaned = stripHtml(text);
  const questionCount = (cleaned.match(/\?/g) ?? []).length;
  const emojiCount = (cleaned.match(EMOJI_PATTERN) ?? []).length;
  const personalPronouns = (cleaned.match(PRONOUN_PATTERN) ?? []).length;
  const cta = detectCTA(cleaned);

  const score =
    Math.min(questionCount * 10, 25) +
    Math.min(emojiCount * 4, 20) +
    (cta.hasCallToAction ? 25 : 0) +
    Math.min(personalPronouns * 5, 30);

  return {
    score: Math.round(clamp(score, 0, 100)),
    factors: {
      hasQuestions: questionCount > 0,
      questionCount,
      emojiCount,
      hasCallToAction: cta.hasCallToAction,
      personalPronouns,
    },
  };
}

export function analyzeScript(text: string): ScriptMetrics {
  const cleaned = stripHtml(text);
  const words = countWords(cleaned);
  const characters = countCharacters(cleaned);
  const sentences = splitSentences(cleaned).length;
  const avgSentenceLength =
    sentences > 0 ? Number((words / sentences).toFixed(2)) : 0;
  const emojiCount = (cleaned.match(EMOJI_PATTERN) ?? []).length;
  const hashtags = (cleaned.match(HASHTAG_PATTERN) ?? []).length;
  const mentions = (cleaned.match(MENTION_PATTERN) ?? []).length;
  const links = (cleaned.match(LINK_PATTERN) ?? []).length;

  const readability = calculateReadability(cleaned);
  const sentiment = analyzeSentiment(cleaned);
  const keywords = getKeywordDensity(cleaned);
  const cta = detectCTA(cleaned);
  const engagement = calculateEngagement(cleaned);

  return {
    readability: {
      score: readability.score,
      level: readability.level,
      grade: readability.grade,
    },
    sentiment: {
      sentiment: sentiment.sentiment,
      score: sentiment.score,
    },
    keywords,
    cta: {
      hasCallToAction: cta.hasCallToAction,
      ctaType: cta.ctaType,
    },
    engagement,
    basic: {
      words,
      characters,
      sentences,
      avgSentenceLength,
      emojis: emojiCount,
      hashtags,
      mentions,
      links,
    },
  };
}

export function createDebouncedAnalyzeScript(delay = 250) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (text: string, callback: (metrics: ScriptMetrics) => void) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(analyzeScript(text));
    }, delay);
  };
}
