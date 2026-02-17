export type ConflictType =
  | "EXCLUSIVITY"
  | "REVISION_LIMIT"
  | "APPROVAL_SLA"
  | "PAYMENT_DISPUTE";

export type ConflictSeverity = "WARN" | "BLOCK";
export type ExclusivityScope = "EXACT_CATEGORY" | "PARENT_CATEGORY";
export type Platform = "INSTAGRAM" | "YOUTUBE" | "TIKTOK";

export type DeliverableForConflictDetection = {
  id: string;
  category: string | null;
  platform: Platform | ReadonlyArray<Platform> | null;
  scheduled_at: Date | string | null;
};

export type ExclusivityRuleForDetection = {
  id: string;
  deal_id: string;
  category_path: string | null;
  scope: ExclusivityScope;
  start_date: Date | string | null;
  end_date: Date | string | null;
  platforms: ReadonlyArray<Platform> | null;
  regions?: string[] | null;
  notes?: string | null;
};

export type Conflict = {
  id?: string;
  type: ConflictType;
  new_deal_or_deliverable_id: string;
  conflicting_rule_id: string;
  overlap: {
    category: {
      deliverable: string;
      rule: string;
      scope: ExclusivityScope;
    };
    date: {
      deliverable_scheduled_at: string;
      rule_start_date: string;
      rule_end_date: string;
    };
    platforms: {
      deliverable: Platform[];
      rule: Platform[];
      matched: Platform[];
    };
  };
  severity: ConflictSeverity;
  suggested_resolutions: string[];
  auto_resolved: boolean;
};

export function detectExclusivityConflicts(
  deliverable: DeliverableForConflictDetection,
  existingRules: ExclusivityRuleForDetection[],
): Conflict[] {
  const scheduledAt = toOptionalDate(deliverable.scheduled_at);
  const deliverableCategory = normalizeCategory(deliverable.category);
  const deliverablePlatforms = normalizePlatforms(deliverable.platform);

  if (
    !scheduledAt ||
    !deliverableCategory ||
    deliverablePlatforms.length === 0
  ) {
    return [];
  }

  const conflicts: Conflict[] = [];

  for (const rule of existingRules) {
    const ruleCategory = normalizeCategory(rule.category_path);
    const rulePlatforms = normalizePlatforms(rule.platforms);

    if (!ruleCategory || rulePlatforms.length === 0) {
      continue;
    }

    if (!isCategoryMatch(deliverableCategory, ruleCategory, rule.scope)) {
      continue;
    }

    const startDate = toOptionalDate(rule.start_date);
    const endDate = toOptionalDate(rule.end_date);
    if (
      !startDate ||
      !endDate ||
      scheduledAt < startDate ||
      scheduledAt > endDate
    ) {
      continue;
    }

    const matchedPlatforms = deliverablePlatforms.filter((platform) =>
      rulePlatforms.includes(platform),
    );
    if (matchedPlatforms.length === 0) {
      continue;
    }

    conflicts.push({
      type: "EXCLUSIVITY",
      new_deal_or_deliverable_id: deliverable.id,
      conflicting_rule_id: rule.id,
      overlap: {
        category: {
          deliverable: deliverableCategory,
          rule: ruleCategory,
          scope: rule.scope,
        },
        date: {
          deliverable_scheduled_at: scheduledAt.toISOString(),
          rule_start_date: toIsoDate(startDate),
          rule_end_date: toIsoDate(endDate),
        },
        platforms: {
          deliverable: deliverablePlatforms,
          rule: rulePlatforms,
          matched: matchedPlatforms,
        },
      },
      severity: "BLOCK",
      suggested_resolutions: [
        "Reschedule the deliverable outside the exclusivity window.",
        "Move the deliverable to a non-conflicting platform.",
        `Request a written exclusivity waiver for rule ${rule.id}.`,
      ],
      auto_resolved: false,
    });
  }

  return conflicts;
}

function isCategoryMatch(
  deliverableCategory: string,
  ruleCategory: string,
  scope: ExclusivityScope,
) {
  if (scope === "EXACT_CATEGORY") {
    return deliverableCategory === ruleCategory;
  }

  return (
    deliverableCategory === ruleCategory ||
    deliverableCategory.startsWith(`${ruleCategory}/`)
  );
}

function normalizeCategory(category: string | null | undefined): string | null {
  if (!category) {
    return null;
  }

  const normalized = category
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/")
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function normalizePlatforms(
  value: Platform | ReadonlyArray<Platform> | null | undefined,
): Platform[] {
  if (!value) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((platform) => platform.trim().toUpperCase())
    .filter(
      (platform): platform is Platform =>
        platform === "INSTAGRAM" ||
        platform === "YOUTUBE" ||
        platform === "TIKTOK",
    );

  return Array.from(new Set(normalized));
}

function toOptionalDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
