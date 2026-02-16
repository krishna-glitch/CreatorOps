import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "@/src/lib/voice/commandParser";

describe("parseVoiceCommand", () => {
  it("parses free-form create deal phrasing with word-number amount and deliverables", () => {
    const result = parseVoiceCommand(
      "Nike collab fifteen hundred dollars two reels",
      ["Nike", "Adidas"],
    );

    expect(result.intent).toBe("CREATE_DEAL");
    if (result.intent !== "CREATE_DEAL") {
      return;
    }

    expect(result.brandName).toBe("Nike");
    expect(result.amount).toBe(1500);
    expect(result.currency).toBe("USD");
    expect(result.deliverables).toEqual([
      {
        platform: "INSTAGRAM",
        type: "REEL",
        quantity: 2,
      },
    ]);
  });

  it("parses mark brand as paid command", () => {
    const result = parseVoiceCommand("Mark Nike as paid", ["Nike"]);
    expect(result).toEqual(
      expect.objectContaining({
        intent: "UPDATE_DEAL_STATUS",
        brandName: "Nike",
        status: "PAID",
      }),
    );
  });

  it("parses paid me command to add payment", () => {
    const result = parseVoiceCommand("Nike paid me fifteen hundred", ["Nike"]);

    expect(result.intent).toBe("ADD_PAYMENT");
    if (result.intent !== "ADD_PAYMENT") {
      return;
    }

    expect(result.brandName).toBe("Nike");
    expect(result.amount).toBe(1500);
    expect(result.currency).toBe("USD");
    expect(result.kind).toBe("FINAL");
    expect(result.markAsPaid).toBe(true);
  });

  it("parses posted deliverable command", () => {
    const result = parseVoiceCommand("Posted Nike reel", ["Nike"]);
    expect(result).toEqual(
      expect.objectContaining({
        intent: "MARK_DELIVERABLE_POSTED",
        brandName: "Nike",
        deliverableType: "REEL",
      }),
    );
  });

  it("parses unpaid deals filter command", () => {
    const result = parseVoiceCommand("Show unpaid deals");
    expect(result.intent).toBe("SHOW_UNPAID_DEALS");
  });

  it("parses open new deal form command", () => {
    const result = parseVoiceCommand("Create new deal");
    expect(result.intent).toBe("OPEN_NEW_DEAL_FORM");
  });
});
