import { wordsToNumbers } from "words-to-numbers";

export type VoiceDealStatus =
  | "INBOUND"
  | "NEGOTIATING"
  | "AGREED"
  | "PAID"
  | "CANCELLED";

export type VoicePaymentCurrency = "USD" | "INR" | "OTHER";
export type VoicePaymentKind = "DEPOSIT" | "FINAL" | "PARTIAL";
export type VoicePaymentMethod =
  | "PAYPAL"
  | "WIRE"
  | "VENMO"
  | "ZELLE"
  | "OTHER";

export type VoiceDeliverableType =
  | "REEL"
  | "POST"
  | "STORY"
  | "SHORT"
  | "VIDEO";

export type VoiceDeliverable = {
  platform: "INSTAGRAM" | "YOUTUBE" | "TIKTOK";
  type: VoiceDeliverableType;
  quantity: number;
};

export type VoiceIntent =
  | "CREATE_DEAL"
  | "MARK_PAID"
  | "ADD_PAYMENT"
  | "MARK_POSTED"
  | "SHOW_UNPAID_DEALS"
  | "OPEN_NEW_DEAL_FORM"
  | "UNKNOWN";

export type ParsedCommand = {
  intent: VoiceIntent;
  entities: {
    brand?: string;
    amount?: number;
    currency?: "USD" | "INR";
    deliverables: VoiceDeliverable[];
    deliverableType?: VoiceDeliverableType;
  };
  confidence: number;
  transcript: string;
};

export type VoiceCommand =
  | {
      intent: "CREATE_DEAL";
      title?: string;
      brandName?: string;
      amount?: number;
      currency?: "USD" | "INR";
      status?: VoiceDealStatus;
      deliverables?: VoiceDeliverable[];
      transcript: string;
    }
  | {
      intent: "UPDATE_DEAL_STATUS";
      brandName?: string;
      status: VoiceDealStatus;
      transcript: string;
    }
  | {
      intent: "ADD_PAYMENT";
      brandName?: string;
      amount?: number;
      currency?: VoicePaymentCurrency;
      kind?: VoicePaymentKind;
      paymentMethod?: VoicePaymentMethod;
      markAsPaid?: boolean;
      transcript: string;
    }
  | {
      intent: "MARK_DELIVERABLE_POSTED";
      brandName?: string;
      deliverableType?: VoiceDeliverableType;
      transcript: string;
    }
  | {
      intent: "SHOW_UNPAID_DEALS";
      transcript: string;
    }
  | {
      intent: "OPEN_NEW_DEAL_FORM";
      transcript: string;
    }
  | {
      intent: "UNKNOWN";
      transcript: string;
    };

const NUMBER_WORDS_REGEX =
  /(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|and)/i;

const DELIVERABLE_MAP: Record<string, VoiceDeliverableType> = {
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

function normalizeTranscript(transcript: string) {
  return transcript.toLowerCase().trim().replace(/\s+/g, " ");
}

function resolveBrand(rawBrand: string, knownBrands: string[]) {
  const candidate = rawBrand.trim();
  if (!candidate) {
    return undefined;
  }

  const normalizedCandidate = candidate.toLowerCase();
  const exact = knownBrands.find(
    (brand) => brand.trim().toLowerCase() === normalizedCandidate,
  );
  if (exact) {
    return exact;
  }

  const partial = knownBrands.find((brand) =>
    brand.trim().toLowerCase().includes(normalizedCandidate),
  );
  if (partial) {
    return partial;
  }

  return candidate;
}

function parseCurrency(text: string): "USD" | "INR" | undefined {
  if (/\$|\busd\b|\bdollars?\b/i.test(text)) {
    return "USD";
  }
  if (/₹|\binr\b|\brupees?\b|\brs\.?\b/i.test(text)) {
    return "INR";
  }
  return undefined;
}

function toNumber(raw: string) {
  const numeric = Number(raw.replace(/,/g, ""));
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const converted = wordsToNumbers(raw);
  if (typeof converted === "number" && Number.isFinite(converted)) {
    return converted;
  }

  if (typeof converted === "string") {
    const fromString = Number(converted.replace(/,/g, ""));
    if (Number.isFinite(fromString)) {
      return fromString;
    }
  }

  return undefined;
}

function parseAmount(text: string) {
  const tryScaled = (raw: string) => {
    const scaled = /^([\d.,]+)\s*([km])$/i.exec(raw.trim());
    if (!scaled?.[1]) {
      return undefined;
    }

    const base = Number(scaled[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) {
      return undefined;
    }

    const multiplier = scaled[2]?.toLowerCase() === "m" ? 1_000_000 : 1000;
    const amount = base * multiplier;
    return amount > 0 ? amount : undefined;
  };

  const parseFromTail = (value: string) => {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return undefined;
    }

    const numericMatches = [...value.matchAll(/\d[\d,.]*(?:\s*[km])?/g)];
    const lastNumeric = numericMatches.at(-1)?.[0];
    if (lastNumeric) {
      const scaled = tryScaled(lastNumeric);
      if (scaled) {
        return scaled;
      }

      const parsedNumeric = toNumber(lastNumeric);
      if (parsedNumeric && parsedNumeric > 0) {
        return parsedNumeric;
      }
    }

    let best: number | undefined;
    const startWindow = Math.max(0, tokens.length - 8);
    for (let start = startWindow; start < tokens.length; start += 1) {
      const candidate = tokens.slice(start).join(" ");
      if (!NUMBER_WORDS_REGEX.test(candidate)) {
        continue;
      }

      const parsedWords = toNumber(candidate);
      if (parsedWords && parsedWords > 0 && (!best || parsedWords > best)) {
        best = parsedWords;
      }
    }

    return best;
  };

  const currencyTokenPattern = /(?:\$|₹|usd|inr|dollars?|rupees?|rs\.?)/gi;
  let currencyTokenMatch = currencyTokenPattern.exec(text);
  while (currencyTokenMatch !== null) {
    const token = currencyTokenMatch[0] ?? "";
    const tokenIndex = currencyTokenMatch.index;
    const before = text.slice(Math.max(0, tokenIndex - 48), tokenIndex);
    const after = text.slice(
      tokenIndex + token.length,
      tokenIndex + token.length + 24,
    );

    const fromBefore = parseFromTail(before);
    if (fromBefore && fromBefore > 0) {
      return fromBefore;
    }

    const fromAfter = parseFromTail(after);
    if (fromAfter && fromAfter > 0) {
      return fromAfter;
    }

    currencyTokenMatch = currencyTokenPattern.exec(text);
  }

  const digitsPattern = /\b(\d[\d,.]*)\b/;
  const digitMatch = digitsPattern.exec(text);
  if (digitMatch?.[1]) {
    const parsed = toNumber(digitMatch[1]);
    if (parsed && parsed > 0) {
      return parsed;
    }
  }

  if (NUMBER_WORDS_REGEX.test(text)) {
    const parsed = toNumber(text);
    if (parsed && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function parseQuantity(raw: string | undefined) {
  if (!raw) {
    return 1;
  }

  const parsed = toNumber(raw.trim());
  if (!parsed || parsed <= 0) {
    return 1;
  }

  return Math.floor(parsed);
}

function inferPlatform(text: string, type: VoiceDeliverableType) {
  if (/\btiktok\b|\btt\b/i.test(text)) {
    return "TIKTOK" as const;
  }
  if (/\byoutube\b|\byt\b/i.test(text)) {
    return "YOUTUBE" as const;
  }
  if (type === "SHORT" || type === "VIDEO") {
    return "YOUTUBE" as const;
  }
  return "INSTAGRAM" as const;
}

function parseDeliverables(text: string): VoiceDeliverable[] {
  const pattern =
    /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+)?(reels?|posts?|stories?|shorts?|videos?)\b/gi;
  const parsed: VoiceDeliverable[] = [];

  let match = pattern.exec(text);
  while (match !== null) {
    const type = DELIVERABLE_MAP[match[2]?.toLowerCase() ?? ""];
    if (type) {
      parsed.push({
        type,
        quantity: parseQuantity(match[1]),
        platform: inferPlatform(text, type),
      });
    }
    match = pattern.exec(text);
  }

  return parsed;
}

function emptyEntities() {
  return {
    deliverables: [] as VoiceDeliverable[],
  };
}

export function parseCommand(
  transcript: string,
  knownBrands: string[] = [],
): ParsedCommand {
  const text = normalizeTranscript(transcript);
  const createPattern = /(.+?)\s+(collab|collaboration|deal)\s+(.+)/i;
  const paidPattern = /mark\s+(.+?)\s+(as\s+)?paid/i;
  const paymentPattern = /(.+?)\s+paid\s+me\s+(.+)/i;
  const postedPattern = /posted\s+(.+?)\s+(reel|post|story|video|short)/i;

  if (/^\s*(create(?:\s+new)?\s+deal|new deal)\s*$/i.test(text)) {
    return {
      intent: "OPEN_NEW_DEAL_FORM",
      entities: emptyEntities(),
      confidence: 0.99,
      transcript,
    };
  }

  if (/\bshow\s+unpaid\s+deals?\b/i.test(text)) {
    return {
      intent: "SHOW_UNPAID_DEALS",
      entities: emptyEntities(),
      confidence: 0.98,
      transcript,
    };
  }

  const createMatch = createPattern.exec(text);
  if (createMatch) {
    const brand = resolveBrand(createMatch[1] ?? "", knownBrands);
    const details = createMatch[3] ?? "";
    return {
      intent: "CREATE_DEAL",
      entities: {
        brand,
        amount: parseAmount(details),
        currency: parseCurrency(details),
        deliverables: parseDeliverables(details),
      },
      confidence: 0.86,
      transcript,
    };
  }

  const paidMatch = paidPattern.exec(text);
  if (paidMatch?.[1]) {
    return {
      intent: "MARK_PAID",
      entities: {
        brand: resolveBrand(paidMatch[1], knownBrands),
        deliverables: [],
      },
      confidence: 0.9,
      transcript,
    };
  }

  const paymentMatch = paymentPattern.exec(text);
  if (paymentMatch?.[1] && paymentMatch?.[2]) {
    return {
      intent: "ADD_PAYMENT",
      entities: {
        brand: resolveBrand(paymentMatch[1], knownBrands),
        amount: parseAmount(paymentMatch[2]),
        currency: parseCurrency(paymentMatch[2]),
        deliverables: [],
      },
      confidence: 0.9,
      transcript,
    };
  }

  const postedMatch = postedPattern.exec(text);
  if (postedMatch?.[1] && postedMatch?.[2]) {
    const typeToken = postedMatch[2].toLowerCase();
    const deliverableType =
      typeToken === "reel"
        ? "REEL"
        : typeToken === "post"
          ? "POST"
          : typeToken === "story"
            ? "STORY"
            : typeToken === "short"
              ? "SHORT"
              : "VIDEO";

    return {
      intent: "MARK_POSTED",
      entities: {
        brand: resolveBrand(postedMatch[1], knownBrands),
        deliverables: [],
        deliverableType,
      },
      confidence: 0.88,
      transcript,
    };
  }

  return {
    intent: "UNKNOWN",
    entities: emptyEntities(),
    confidence: 0.2,
    transcript,
  };
}

export function parseVoiceCommand(
  transcript: string,
  knownBrands: string[] = [],
  defaultCurrency: "USD" | "INR" = "USD",
): VoiceCommand {
  const parsed = parseCommand(transcript, knownBrands);

  if (parsed.intent === "OPEN_NEW_DEAL_FORM") {
    return { intent: "OPEN_NEW_DEAL_FORM", transcript };
  }
  if (parsed.intent === "SHOW_UNPAID_DEALS") {
    return { intent: "SHOW_UNPAID_DEALS", transcript };
  }
  if (parsed.intent === "MARK_PAID") {
    return {
      intent: "UPDATE_DEAL_STATUS",
      brandName: parsed.entities.brand,
      status: "PAID",
      transcript,
    };
  }
  if (parsed.intent === "MARK_POSTED") {
    return {
      intent: "MARK_DELIVERABLE_POSTED",
      brandName: parsed.entities.brand,
      deliverableType: parsed.entities.deliverableType,
      transcript,
    };
  }
  if (parsed.intent === "ADD_PAYMENT") {
    return {
      intent: "ADD_PAYMENT",
      brandName: parsed.entities.brand,
      amount: parsed.entities.amount,
      currency: parsed.entities.currency ?? defaultCurrency,
      kind: "FINAL",
      markAsPaid: true,
      transcript,
    };
  }
  if (parsed.intent === "CREATE_DEAL") {
    return {
      intent: "CREATE_DEAL",
      brandName: parsed.entities.brand,
      amount: parsed.entities.amount,
      currency: parsed.entities.currency ?? defaultCurrency,
      deliverables: parsed.entities.deliverables,
      status: "INBOUND",
      transcript,
    };
  }

  return {
    intent: "UNKNOWN",
    transcript,
  };
}
