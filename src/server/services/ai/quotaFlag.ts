const DEFAULT_QUOTA_DISABLE_MS = 30 * 60 * 1000;

type QuotaDisableReason = "quota_limit";

type QuotaFlagState = {
  disabledUntilMs: number | null;
  reason: QuotaDisableReason | null;
  lastError: string | null;
};

const quotaFlagState: QuotaFlagState = {
  disabledUntilMs: null,
  reason: null,
  lastError: null,
};

function getQuotaDisableMs() {
  const raw = process.env.AI_QUOTA_DISABLE_MS?.trim();
  if (!raw) {
    return DEFAULT_QUOTA_DISABLE_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_QUOTA_DISABLE_MS;
  }

  return Math.floor(parsed);
}

function clearIfExpired(now: number) {
  if (
    quotaFlagState.disabledUntilMs !== null &&
    now >= quotaFlagState.disabledUntilMs
  ) {
    quotaFlagState.disabledUntilMs = null;
    quotaFlagState.reason = null;
    quotaFlagState.lastError = null;
  }
}

export function disableAIExtractionDueToQuota(errorMessage?: string) {
  const now = Date.now();
  const cooldownMs = getQuotaDisableMs();

  quotaFlagState.disabledUntilMs = now + cooldownMs;
  quotaFlagState.reason = "quota_limit";
  quotaFlagState.lastError = errorMessage?.slice(0, 500) ?? null;
}

export function getAIExtractionAvailability() {
  const now = Date.now();
  clearIfExpired(now);

  const enabled =
    quotaFlagState.disabledUntilMs === null ||
    now >= quotaFlagState.disabledUntilMs;

  return {
    enabled,
    reason: quotaFlagState.reason,
    lastError: quotaFlagState.lastError,
    disabledUntil:
      quotaFlagState.disabledUntilMs !== null
        ? new Date(quotaFlagState.disabledUntilMs).toISOString()
        : null,
  };
}
