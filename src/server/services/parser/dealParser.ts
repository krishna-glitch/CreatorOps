import { z } from "zod";

// ── Output schema (matches Groq AI extractor exactly) ──────────────────

const deliverableSchema = z.object({
    platform: z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"]),
    type: z.enum(["REEL", "POST", "STORY", "SHORT", "VIDEO"]),
    quantity: z.number().int().positive(),
});

const extractedDealSchema = z.object({
    brand_name: z.string().trim().min(1).nullable(),
    total_value: z.number().positive().finite().nullable(),
    currency: z.enum(["USD", "INR"]).nullable(),
    deliverables: z.array(deliverableSchema),
    status: z.enum(["INBOUND", "NEGOTIATING", "AGREED"]),
    confidence: z.number().min(0).max(1),
});

export type ExtractedDeal = z.infer<typeof extractedDealSchema>;

type Currency = "USD" | "INR";
type Platform = "INSTAGRAM" | "YOUTUBE" | "TIKTOK";
type ContentType = "REEL" | "POST" | "STORY" | "SHORT" | "VIDEO";

interface RawDeliverable {
    platform: Platform;
    type: ContentType;
    quantity: number;
}

// ── Currency Extraction ────────────────────────────────────────────────

const CURRENCY_PATTERNS: Array<{ pattern: RegExp; currency: Currency }> = [
    { pattern: /\$/, currency: "USD" },
    { pattern: /\bUSD\b/i, currency: "USD" },
    { pattern: /\bu\.?s\.?\s*dollars?\b/i, currency: "USD" },
    { pattern: /\bdollars?\b/i, currency: "USD" },
    { pattern: /₹/, currency: "INR" },
    { pattern: /\bINR\b/i, currency: "INR" },
    { pattern: /\brs\.?\b/i, currency: "INR" },
    { pattern: /\brupees?\b/i, currency: "INR" },
];

export function extractCurrency(text: string): Currency | null {
    const monetary = extractAmountAndCurrency(text);
    if (monetary.currency) {
        return monetary.currency;
    }

    for (const { pattern, currency } of CURRENCY_PATTERNS) {
        if (pattern.test(text)) {
            return currency;
        }
    }

    return null;
}

// ── Amount Extraction ──────────────────────────────────────────────────

const CURRENCY_TOKEN_REGEX =
    /(?:\$|₹|USD|INR|rs\.?|rupees?|dollars?)/i;
const MULTIPLIER_REGEX = /([kKmM])?/;

const AMOUNT_WITH_CURRENCY_PATTERNS: RegExp[] = [
    new RegExp(
        `(${CURRENCY_TOKEN_REGEX.source})\\s*([\\d.,]+)\\s*${MULTIPLIER_REGEX.source}`,
        "gi",
    ),
    new RegExp(
        `([\\d.,]+)\\s*${MULTIPLIER_REGEX.source}\\s*(${CURRENCY_TOKEN_REGEX.source})\\b`,
        "gi",
    ),
];

const BARE_AMOUNT_PATTERNS: RegExp[] = [
    /\b([\d.,]+)\s*([kKmM])\b/g,
    /\b(?:budget|rate|pricing|price|cost|fee|pay|payment|for)\s*[:\-]?\s*([\d.,]+)\b/gi,
];

function parseNumericValue(raw: string, multiplierRaw?: string): number | null {
    let cleaned = raw.trim().replace(/\s+/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
        cleaned = cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
        const decimalLike = /,\d{1,2}$/.test(cleaned);
        cleaned = decimalLike ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
    }

    const num = Number.parseFloat(cleaned);

    if (!Number.isFinite(num) || num <= 0) {
        return null;
    }

    const multiplier = (multiplierRaw ?? "").toLowerCase();
    if (multiplier === "k") {
        return num * 1000;
    }
    if (multiplier === "m") {
        return num * 1_000_000;
    }

    return num;
}

function normalizeCurrency(raw: string): Currency | null {
    const normalized = raw.toLowerCase();
    if (normalized.includes("$") || normalized.includes("usd") || normalized.includes("dollar")) {
        return "USD";
    }
    if (
        normalized.includes("₹") ||
        normalized.includes("inr") ||
        normalized.includes("rupee") ||
        normalized.includes("rs")
    ) {
        return "INR";
    }

    return null;
}

function extractAmountAndCurrency(text: string): {
    amount: number | null;
    currency: Currency | null;
} {
    type Candidate = { amount: number; currency: Currency; index: number };
    const candidates: Candidate[] = [];

    for (const pattern of AMOUNT_WITH_CURRENCY_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null = null;

        while ((match = pattern.exec(text)) !== null) {
            const tokenA = match[1] ?? "";
            const tokenB = match[2] ?? "";
            const tokenC = match[3] ?? "";

            const currency = normalizeCurrency(tokenA) ?? normalizeCurrency(tokenC);
            const amountRaw = normalizeCurrency(tokenA) ? tokenB : tokenA;
            const multiplier = normalizeCurrency(tokenA) ? tokenC : tokenB;

            if (!currency || !amountRaw) {
                continue;
            }

            const amount = parseNumericValue(amountRaw, multiplier);
            if (amount === null) {
                continue;
            }

            candidates.push({
                amount,
                currency,
                index: match.index,
            });
        }
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => a.index - b.index);
        const best = candidates[candidates.length - 1];
        return {
            amount: best?.amount ?? null,
            currency: best?.currency ?? null,
        };
    }

    for (const pattern of BARE_AMOUNT_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (!match?.[1]) {
            continue;
        }

        const amount = parseNumericValue(match[1], match[2]);
        if (amount !== null) {
            return { amount, currency: null };
        }
    }

    return { amount: null, currency: null };
}

export function extractAmount(text: string): number | null {
    return extractAmountAndCurrency(text).amount;
}

// ── Deliverable Extraction ─────────────────────────────────────────────

const CONTENT_TYPE_MAP: Record<string, ContentType> = {
    reel: "REEL",
    reels: "REEL",
    post: "POST",
    posts: "POST",
    story: "STORY",
    stories: "STORY",
    short: "SHORT",
    shorts: "SHORT",
    video: "VIDEO",
    videos: "VIDEO",
};

const PLATFORM_KEYWORDS: Record<string, Platform> = {
    instagram: "INSTAGRAM",
    ig: "INSTAGRAM",
    insta: "INSTAGRAM",
    youtube: "YOUTUBE",
    yt: "YOUTUBE",
    tiktok: "TIKTOK",
    "tik tok": "TIKTOK",
    tt: "TIKTOK",
};

const TYPE_TO_DEFAULT_PLATFORM: Record<ContentType, Platform> = {
    REEL: "INSTAGRAM",
    POST: "INSTAGRAM",
    STORY: "INSTAGRAM",
    SHORT: "YOUTUBE",
    VIDEO: "YOUTUBE",
};

// Matches: "2 reels", "a reel", "one post", "3 youtube videos", "tiktok video"
const DELIVERABLE_PATTERN =
    /(?:((?:\d+\s*(?:x)?)|(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten))\s+)?(?:(instagram|ig|insta|youtube|yt|tiktok|tik\s*tok|tt)\s+)?(reels?|posts?|stor(?:y|ies)|shorts?|videos?)\b/gi;

const WORD_TO_NUMBER: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
};

function inferPlatform(
    explicitPlatform: string | undefined,
    contentType: ContentType,
    fullText: string,
    matchIndex: number,
): Platform {
    // If the pattern captured a platform keyword, use it
    if (explicitPlatform) {
        const normalized = explicitPlatform.toLowerCase().replace(/\s+/g, "");
        const mapped = PLATFORM_KEYWORDS[normalized];
        if (mapped) {
            return mapped;
        }
    }

    // Look for a platform keyword within 30 chars before the match
    const lookbackStart = Math.max(0, matchIndex - 30);
    const contextBefore = fullText.slice(lookbackStart, matchIndex).toLowerCase();

    for (const [keyword, platform] of Object.entries(PLATFORM_KEYWORDS)) {
        if (contextBefore.includes(keyword)) {
            return platform;
        }
    }

    // Fall back to default platform for this content type
    return TYPE_TO_DEFAULT_PLATFORM[contentType];
}

export function extractDeliverables(text: string): RawDeliverable[] {
    const results: RawDeliverable[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null = null;
    // Reset lastIndex for global regex
    DELIVERABLE_PATTERN.lastIndex = 0;

    while ((match = DELIVERABLE_PATTERN.exec(text)) !== null) {
        const quantityRaw = match[1];
        const platformRaw = match[2];
        const typeRaw = match[3];

        if (!typeRaw) {
            continue;
        }

        const contentType = CONTENT_TYPE_MAP[typeRaw.toLowerCase()];
        if (!contentType) {
            continue;
        }

        const normalizedQuantityRaw = quantityRaw?.toLowerCase().replace(/\s*x$/, "");
        const quantity = normalizedQuantityRaw
            ? (/^\d+$/.test(normalizedQuantityRaw)
                ? Number.parseInt(normalizedQuantityRaw, 10)
                : (WORD_TO_NUMBER[normalizedQuantityRaw] ?? 1))
            : 1;

        if (quantity <= 0 || !Number.isFinite(quantity)) {
            continue;
        }

        const platform = inferPlatform(platformRaw, contentType, text, match.index);
        const key = `${platform}:${contentType}`;

        if (seen.has(key)) {
            // Merge: add quantity to existing
            const existing = results.find(
                (r) => r.platform === platform && r.type === contentType,
            );
            if (existing) {
                existing.quantity += quantity;
            }
            continue;
        }

        seen.add(key);
        results.push({ platform, type: contentType, quantity });
    }

    return results;
}

// ── Brand Matching ─────────────────────────────────────────────────────

function normalizeName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ");
}

function tokenize(name: string): Set<string> {
    return new Set(
        normalizeName(name)
            .split(" ")
            .filter((t) => t.length > 0),
    );
}

// Stop words that should not be considered brand candidates
const STOP_WORDS = new Set([
    "i", "me", "my", "we", "our", "you", "your", "the", "a", "an",
    "and", "or", "but", "for", "with", "from", "to", "in", "on", "at",
    "of", "is", "are", "was", "were", "be", "been", "has", "have", "had",
    "do", "does", "did", "will", "would", "can", "could", "should",
    "want", "wants", "need", "needs", "like", "get", "got", "make",
    "this", "that", "it", "its", "they", "them", "their",
    "someone", "somebody",
    "deal", "deals", "brand", "campaign", "collab", "collaboration",
    "payment", "paid", "pay", "rate", "price", "budget",
    "reel", "reels", "post", "posts", "story", "stories", "video", "videos",
    "short", "shorts", "instagram", "youtube", "tiktok", "ig", "yt", "tt",
    "insta", "hey", "hi", "hello", "thanks", "thank", "please",
]);

function tokenOverlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) intersection += 1;
    }

    const union = new Set([...a, ...b]).size;
    return union > 0 ? intersection / union : 0;
}

export function extractBrandCandidate(
    text: string,
    knownBrands: string[],
): string | null {
    const normalizedText = normalizeName(text);
    let bestBrand: string | null = null;
    let bestScore = 0;

    for (const brandName of knownBrands) {
        const normalizedBrand = normalizeName(brandName);
        if (!normalizedBrand) continue;

        // Exact substring match
        if (normalizedText.includes(normalizedBrand)) {
            const score = normalizedBrand.length / normalizedText.length + 0.5;
            if (score > bestScore) {
                bestScore = score;
                bestBrand = brandName;
            }
            continue;
        }

        // Token overlap
        const brandTokens = tokenize(brandName);
        const textTokens = tokenize(text);

        // Filter out stop words from text tokens for matching
        const filteredTextTokens = new Set(
            [...textTokens].filter((t) => !STOP_WORDS.has(t)),
        );

        const overlap = tokenOverlap(brandTokens, filteredTextTokens);
        if (overlap > bestScore && overlap >= 0.4) {
            bestScore = overlap;
            bestBrand = brandName;
        }
    }

    if (bestBrand) {
        return bestBrand;
    }

    return inferBrandFromText(text);
}

function cleanInferredBrand(value: string): string | null {
    const cleaned = value
        .trim()
        .replace(/^[\s"'`]+|[\s"'`.,!?]+$/g, "")
        .replace(/\b(marketing|partnerships?|team|agency)\b.*$/i, "")
        .replace(/\s+/g, " ");
    const cleanedTrimmed = cleaned.trim();

    if (!cleanedTrimmed) {
        return null;
    }

    const normalized = normalizeName(cleanedTrimmed);
    if (!normalized) {
        return null;
    }

    const tokens = normalized.split(" ").filter((token) => token.length > 0);
    if (
        tokens.length === 0 ||
        tokens.every((token) => STOP_WORDS.has(token) || /^\d+$/.test(token))
    ) {
        return null;
    }

    return cleanedTrimmed;
}

function inferBrandFromText(text: string): string | null {
    const patterns = [
        /(?:^|\b)(?:brand|client)\s*[:\-]\s*([a-z][a-z0-9&.'\-]*(?:\s+[a-z][a-z0-9&.'\-]*){0,4}?)(?=\s+(?:wants?|needs?|asked|reached|campaign|deal|collab|for|to|on)\b|[,.!?]|$)/i,
        /^([a-z][a-z0-9&.'\-]*(?:\s+[a-z][a-z0-9&.'\-]*){0,3}?)(?=\s+(?:wants?|needs?|asked|reached|campaign|deal|collab)\b)/i,
        /(?:^|\b)(?:from)\s+([a-z][a-z0-9&.'\-]*(?:\s+[a-z][a-z0-9&.'\-]*){0,3}?)(?=\s+(?:wants?|needs?|asked|reached|campaign|deal|collab|for|to|on)\b|[,.!?]|$)/i,
        /\bthis is\s+[a-z][a-z0-9.'\-]*(?:\s+[a-z][a-z0-9.'\-]*){0,2}\s+from\s+([a-z][a-z0-9&.'\-]*(?:\s+[a-z][a-z0-9&.'\-]*){0,4}?)(?=\s+(?:team|marketing|partnerships|wants?|needs?|for|to|on)\b|[,.!?]|$)/i,
        /^(?:hey|hi|hello)\s+([a-z0-9&.'\-\s]{2,60}?)(?:[,.!?]\s|$)/i,
    ] as const;

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        const candidate = match?.[1] ? cleanInferredBrand(match[1]) : null;
        if (candidate) {
            return candidate;
        }
    }

    return null;
}

// ── Status Classification ──────────────────────────────────────────────

const NEGOTIATION_KEYWORDS = [
    "negotiate",
    "negotiating",
    "negotiation",
    "counter",
    "counteroffer",
    "counter-offer",
    "counter offer",
    "pricing",
    "discuss rate",
    "discuss terms",
    "discuss pricing",
    "budget",
    "lower",
    "higher",
    "increase",
    "decrease",
    "offer",
    "proposal",
];

const AGREED_KEYWORDS = [
    "agreed",
    "agree",
    "locked",
    "locked in",
    "confirmed",
    "confirmation",
    "approved",
    "greenlit",
    "green light",
    "go ahead",
    "finalized",
    "signed",
];

export function classifyStatus(text: string): "INBOUND" | "NEGOTIATING" | "AGREED" {
    const lower = text.toLowerCase();

    for (const keyword of AGREED_KEYWORDS) {
        if (lower.includes(keyword)) {
            return "AGREED";
        }
    }

    for (const keyword of NEGOTIATION_KEYWORDS) {
        if (lower.includes(keyword)) {
            return "NEGOTIATING";
        }
    }

    return "INBOUND";
}

// ── Confidence Calculator ──────────────────────────────────────────────

export function calculateConfidence(result: {
    brand_name: string | null;
    total_value: number | null;
    currency: Currency | null;
    deliverables: RawDeliverable[];
}): number {
    let fieldsFound = 0;
    const totalFields = 4; // brand, amount, currency, deliverables

    if (result.brand_name) fieldsFound += 1;
    if (result.total_value !== null) fieldsFound += 1;
    if (result.currency !== null) fieldsFound += 1;
    if (result.deliverables.length > 0) fieldsFound += 1;

    if (fieldsFound === totalFields) return 0.9;
    if (fieldsFound === totalFields - 1) return 0.7;
    if (fieldsFound >= 2) return 0.5;
    if (fieldsFound === 1) return 0.3;
    return 0.1;
}

function hasScheduleContext(text: string): boolean {
    const lower = text.toLowerCase();
    const patterns = [
        /\b(today|tomorrow|tonight|eod|eow|asap)\b/,
        /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/,
        /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|eod|end of day)\b/,
        /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/,
        /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/,
    ];

    return patterns.some((pattern) => pattern.test(lower));
}

// ── Main Parser ────────────────────────────────────────────────────────

export function parseDealFromMessage(
    message: string,
    knownBrandNames: string[] = [],
): ExtractedDeal {
    const text = message.trim();

    const monetary = extractAmountAndCurrency(text);
    const currency = monetary.currency;
    const total_value = monetary.amount;
    const deliverables = extractDeliverables(text);
    const brand_name = extractBrandCandidate(text, knownBrandNames);
    const status = classifyStatus(text);

    let confidence = calculateConfidence({
        brand_name,
        total_value,
        currency,
        deliverables,
    });

    if (hasScheduleContext(text)) {
        confidence = Math.min(0.95, confidence + 0.05);
    }

    return {
        brand_name,
        total_value,
        currency,
        deliverables,
        status,
        confidence,
    };
}
