import { describe, expect, it } from "vitest";
import { detectExclusivityConflicts } from "@/src/server/domain/services/ConflictDetector";

describe("detectExclusivityConflicts", () => {
  const baseDeliverable = {
    id: "deliv-1",
    category: "Tech/Smartphones",
    platform: "INSTAGRAM" as const,
    scheduled_at: "2026-02-15T10:00:00.000Z",
  };

  it("detects conflict for exact category match", () => {
    const rules = [
      {
        id: "rule-1",
        deal_id: "deal-1",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe("EXCLUSIVITY");
    expect(conflicts[0]?.conflicting_rule_id).toBe("rule-1");
    expect(conflicts[0]?.severity).toBe("BLOCK");
  });

  it("detects conflict for parent category scope", () => {
    const rules = [
      {
        id: "rule-2",
        deal_id: "deal-2",
        category_path: "Tech",
        scope: "PARENT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.conflicting_rule_id).toBe("rule-2");
  });

  it("does not match exact scope for parent-only category", () => {
    const rules = [
      {
        id: "rule-3",
        deal_id: "deal-3",
        category_path: "Tech",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);
    expect(conflicts).toEqual([]);
  });

  it("requires date overlap", () => {
    const rules = [
      {
        id: "rule-4",
        deal_id: "deal-4",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);
    expect(conflicts).toEqual([]);
  });

  it("requires platform overlap", () => {
    const rules = [
      {
        id: "rule-5",
        deal_id: "deal-5",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["YOUTUBE"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);
    expect(conflicts).toEqual([]);
  });

  it("returns no conflicts when scheduled_at is null", () => {
    const rules = [
      {
        id: "rule-6",
        deal_id: "deal-6",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(
      { ...baseDeliverable, scheduled_at: null },
      rules,
    );
    expect(conflicts).toEqual([]);
  });

  it("handles invalid rule dates gracefully", () => {
    const rules = [
      {
        id: "rule-7",
        deal_id: "deal-7",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "invalid-date",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
      {
        id: "rule-8",
        deal_id: "deal-8",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "also-invalid",
        platforms: ["INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);
    expect(conflicts).toEqual([]);
  });

  it("returns multiple conflicts when multiple rules match", () => {
    const rules = [
      {
        id: "rule-9",
        deal_id: "deal-9",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["INSTAGRAM"] as const,
      },
      {
        id: "rule-10",
        deal_id: "deal-10",
        category_path: "Tech",
        scope: "PARENT_CATEGORY" as const,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        platforms: ["INSTAGRAM", "YOUTUBE"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);

    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((item) => item.conflicting_rule_id)).toEqual([
      "rule-9",
      "rule-10",
    ]);
  });

  it("detects overlap correctly with multi-platform rule", () => {
    const rules = [
      {
        id: "rule-11",
        deal_id: "deal-11",
        category_path: "Tech/Smartphones",
        scope: "EXACT_CATEGORY" as const,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        platforms: ["YOUTUBE", "INSTAGRAM"] as const,
      },
    ];

    const conflicts = detectExclusivityConflicts(baseDeliverable, rules);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.overlap.platforms.matched).toEqual(["INSTAGRAM"]);
  });
});
