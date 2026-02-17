import { describe, expect, it } from "vitest";
import {
  calculateConfidence,
  classifyStatus,
  extractAmount,
  extractBrandCandidate,
  extractCurrency,
  extractDeliverables,
  parseDealFromMessage,
} from "@/src/server/services/parser/dealParser";

// ── Currency ───────────────────────────────────────────────────────────

describe("extractCurrency", () => {
  it("detects USD from $", () => {
    expect(extractCurrency("Nike deal for $1500")).toBe("USD");
  });

  it("detects USD from keyword", () => {
    expect(extractCurrency("1500 USD campaign")).toBe("USD");
  });

  it("detects INR from ₹", () => {
    expect(extractCurrency("₹50,000 brand deal")).toBe("INR");
  });

  it("detects INR from keyword", () => {
    expect(extractCurrency("50000 INR")).toBe("INR");
  });

  it("detects INR from rupees", () => {
    expect(extractCurrency("50000 rupees for 3 posts")).toBe("INR");
  });

  it("returns null when no currency found", () => {
    expect(extractCurrency("Nike wants 2 reels")).toBeNull();
  });
});

// ── Amount ──────────────────────────────────────────────────────────────

describe("extractAmount", () => {
  it("extracts $1500", () => {
    expect(extractAmount("Nike deal for $1500")).toBe(1500);
  });

  it("extracts $1,500", () => {
    expect(extractAmount("Deal worth $1,500")).toBe(1500);
  });

  it("extracts $1.5k", () => {
    expect(extractAmount("Campaign for $1.5k")).toBe(1500);
  });

  it("extracts ₹50,000", () => {
    expect(extractAmount("₹50,000 for posts")).toBe(50000);
  });

  it("extracts 1500 USD", () => {
    expect(extractAmount("1500 USD total")).toBe(1500);
  });

  it("extracts 2k INR", () => {
    expect(extractAmount("2k INR for a reel")).toBe(2000);
  });

  it("extracts 5000 rupees", () => {
    expect(extractAmount("5000 rupees for the collab")).toBe(5000);
  });

  it("extracts USD 1.5k", () => {
    expect(extractAmount("USD 1.5k for campaign")).toBe(1500);
  });

  it("extracts 1,5k format", () => {
    expect(extractAmount("budget is 1,5k")).toBe(1500);
  });

  it("uses last amount in multi-currency negotiation", () => {
    expect(extractAmount("Initial ask $1500, final agreed ₹50,000")).toBe(
      50000,
    );
  });

  it("returns null when no amount found", () => {
    expect(extractAmount("Nike wants a reel")).toBeNull();
  });
});

// ── Deliverables ────────────────────────────────────────────────────────

describe("extractDeliverables", () => {
  it("extracts '2 reels' → INSTAGRAM/REEL×2", () => {
    const result = extractDeliverables("Nike wants 2 reels");
    expect(result).toEqual([
      { platform: "INSTAGRAM", type: "REEL", quantity: 2 },
    ]);
  });

  it("extracts '3 posts' → INSTAGRAM/POST×3", () => {
    const result = extractDeliverables("3 posts for the brand");
    expect(result).toEqual([
      { platform: "INSTAGRAM", type: "POST", quantity: 3 },
    ]);
  });

  it("extracts 'a story' → INSTAGRAM/STORY×1", () => {
    const result = extractDeliverables("Need a story and a reel");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "STORY",
      quantity: 1,
    });
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 1,
    });
  });

  it("extracts 'youtube video' → YOUTUBE/VIDEO×1", () => {
    const result = extractDeliverables("1 youtube video");
    expect(result).toEqual([
      { platform: "YOUTUBE", type: "VIDEO", quantity: 1 },
    ]);
  });

  it("extracts 'tiktok video' → TIKTOK/VIDEO", () => {
    const result = extractDeliverables("tiktok video collab");
    expect(result).toEqual([
      { platform: "TIKTOK", type: "VIDEO", quantity: 1 },
    ]);
  });

  it("extracts '2 shorts' → YOUTUBE/SHORT×2", () => {
    const result = extractDeliverables("2 shorts for the campaign");
    expect(result).toEqual([
      { platform: "YOUTUBE", type: "SHORT", quantity: 2 },
    ]);
  });

  it("extracts multiple types", () => {
    const result = extractDeliverables("2 reels and 1 story");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 2,
    });
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "STORY",
      quantity: 1,
    });
  });

  it("extracts number words", () => {
    const result = extractDeliverables("two reels and three stories");
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 2,
    });
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "STORY",
      quantity: 3,
    });
  });

  it("extracts shorthand mixed platform combos", () => {
    const result = extractDeliverables("IG reel + YT short + TT story");
    expect(result).toContainEqual({
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 1,
    });
    expect(result).toContainEqual({
      platform: "YOUTUBE",
      type: "SHORT",
      quantity: 1,
    });
    expect(result).toContainEqual({
      platform: "TIKTOK",
      type: "STORY",
      quantity: 1,
    });
  });

  it("returns empty for no deliverables", () => {
    expect(extractDeliverables("Hey how are you?")).toEqual([]);
  });
});

// ── Brand Matching ──────────────────────────────────────────────────────

describe("extractBrandCandidate", () => {
  const brands = ["Nike", "Adidas", "Apple Inc"];

  it("matches exact brand name in text", () => {
    expect(extractBrandCandidate("Nike wants 2 reels", brands)).toBe("Nike");
  });

  it("matches case-insensitively", () => {
    expect(extractBrandCandidate("ADIDAS wants a post", brands)).toBe("Adidas");
  });

  it("returns null when no brand matches", () => {
    expect(
      extractBrandCandidate("Someone wants 2 reels for $1500", brands),
    ).toBeNull();
  });

  it("returns null for empty brand list", () => {
    expect(extractBrandCandidate("Nike wants 2 reels", [])).toBe("Nike");
  });

  it("infers brand from explicit label", () => {
    expect(extractBrandCandidate("Brand: Acme Co wants 2 reels", [])).toBe(
      "Acme Co",
    );
  });

  it("infers brand from 'from' phrasing", () => {
    expect(
      extractBrandCandidate("Got a message from North Face for 1 reel", []),
    ).toBe("North Face");
  });

  it("infers brand from signature phrasing", () => {
    expect(
      extractBrandCandidate(
        "Hi, this is Maya from Glow Labs marketing team. Need 1 reel.",
        [],
      ),
    ).toBe("Glow Labs");
  });
});

// ── Status Classification ───────────────────────────────────────────────

describe("classifyStatus", () => {
  it("returns INBOUND by default", () => {
    expect(classifyStatus("Nike wants 2 reels for $1500")).toBe("INBOUND");
  });

  it("returns NEGOTIATING for negotiate keyword", () => {
    expect(classifyStatus("Can we negotiate the rate?")).toBe("NEGOTIATING");
  });

  it("returns NEGOTIATING for counter keyword", () => {
    expect(classifyStatus("I have a counter offer")).toBe("NEGOTIATING");
  });

  it("returns NEGOTIATING for pricing keyword", () => {
    expect(classifyStatus("Let's discuss pricing")).toBe("NEGOTIATING");
  });

  it("returns NEGOTIATING for budget keyword", () => {
    expect(classifyStatus("What is your budget?")).toBe("NEGOTIATING");
  });

  it("returns AGREED for confirmation cues", () => {
    expect(classifyStatus("Rate is locked and approved, go ahead")).toBe(
      "AGREED",
    );
  });
});

// ── Confidence Calculator ───────────────────────────────────────────────

describe("calculateConfidence", () => {
  it("returns 0.9 when all fields present", () => {
    expect(
      calculateConfidence({
        brand_name: "Nike",
        total_value: 1500,
        currency: "USD",
        deliverables: [{ platform: "INSTAGRAM", type: "REEL", quantity: 2 }],
      }),
    ).toBe(0.9);
  });

  it("returns 0.7 when 3 of 4 fields present", () => {
    expect(
      calculateConfidence({
        brand_name: "Nike",
        total_value: 1500,
        currency: "USD",
        deliverables: [],
      }),
    ).toBe(0.7);
  });

  it("returns 0.5 when 2 fields present", () => {
    expect(
      calculateConfidence({
        brand_name: "Nike",
        total_value: null,
        currency: null,
        deliverables: [{ platform: "INSTAGRAM", type: "REEL", quantity: 2 }],
      }),
    ).toBe(0.5);
  });

  it("returns 0.3 when 1 field present", () => {
    expect(
      calculateConfidence({
        brand_name: "Nike",
        total_value: null,
        currency: null,
        deliverables: [],
      }),
    ).toBe(0.3);
  });

  it("returns 0.1 when no fields present", () => {
    expect(
      calculateConfidence({
        brand_name: null,
        total_value: null,
        currency: null,
        deliverables: [],
      }),
    ).toBe(0.1);
  });
});

// ── Full Parser Integration ─────────────────────────────────────────────

describe("parseDealFromMessage", () => {
  it("parses a complete deal message", () => {
    const result = parseDealFromMessage("Nike wants 2 reels for $1500", [
      "Nike",
      "Adidas",
    ]);

    expect(result.brand_name).toBe("Nike");
    expect(result.total_value).toBe(1500);
    expect(result.currency).toBe("USD");
    expect(result.deliverables).toEqual([
      { platform: "INSTAGRAM", type: "REEL", quantity: 2 },
    ]);
    expect(result.status).toBe("INBOUND");
    expect(result.confidence).toBe(0.9);
  });

  it("parses INR deal with posts", () => {
    const result = parseDealFromMessage("₹50,000 for 3 posts", []);

    expect(result.brand_name).toBeNull();
    expect(result.total_value).toBe(50000);
    expect(result.currency).toBe("INR");
    expect(result.deliverables).toEqual([
      { platform: "INSTAGRAM", type: "POST", quantity: 3 },
    ]);
    expect(result.status).toBe("INBOUND");
    expect(result.confidence).toBe(0.7); // 3 of 4 fields
  });

  it("parses negotiation message", () => {
    const result = parseDealFromMessage(
      "Can we negotiate the rate for the campaign?",
      [],
    );

    expect(result.status).toBe("NEGOTIATING");
  });

  it("handles empty/noise message", () => {
    const result = parseDealFromMessage("Hey how are you?", []);

    expect(result.brand_name).toBeNull();
    expect(result.total_value).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.deliverables).toEqual([]);
    expect(result.status).toBe("INBOUND");
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it("parses k-suffix amount", () => {
    const result = parseDealFromMessage("1.5k USD campaign", []);

    expect(result.total_value).toBe(1500);
    expect(result.currency).toBe("USD");
  });

  it("handles multiple deliverables", () => {
    const result = parseDealFromMessage("2 reels and 1 story for Nike", [
      "Nike",
    ]);

    expect(result.deliverables).toHaveLength(2);
    expect(result.deliverables).toContainEqual({
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 2,
    });
    expect(result.deliverables).toContainEqual({
      platform: "INSTAGRAM",
      type: "STORY",
      quantity: 1,
    });
  });

  it("prefers final negotiated currency/amount context", () => {
    const result = parseDealFromMessage(
      "Client asked for $1000 earlier, now final is INR 90,000",
      [],
    );

    expect(result.total_value).toBe(90000);
    expect(result.currency).toBe("INR");
  });

  it("classifies agreed intent from closure language", () => {
    const result = parseDealFromMessage(
      "Deal is confirmed and locked, posting by Friday",
      [],
    );

    expect(result.status).toBe("AGREED");
  });
});
