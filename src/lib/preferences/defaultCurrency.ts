"use client";

export type DefaultCurrency = "USD" | "INR";

export const DEFAULT_CURRENCY_STORAGE_KEY =
  "creatorops.preferences.defaultCurrency.v1";
export const DEFAULT_CURRENCY_CHANGED_EVENT =
  "creatorops:default-currency-changed";
export const FALLBACK_DEFAULT_CURRENCY: DefaultCurrency = "USD";

function isDefaultCurrency(value: unknown): value is DefaultCurrency {
  return value === "USD" || value === "INR";
}

export function getStoredDefaultCurrency(): DefaultCurrency {
  if (typeof window === "undefined") {
    return FALLBACK_DEFAULT_CURRENCY;
  }

  const stored = window.localStorage.getItem(DEFAULT_CURRENCY_STORAGE_KEY);
  return isDefaultCurrency(stored) ? stored : FALLBACK_DEFAULT_CURRENCY;
}

export function setStoredDefaultCurrency(currency: DefaultCurrency) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEFAULT_CURRENCY_STORAGE_KEY, currency);
  window.dispatchEvent(
    new CustomEvent(DEFAULT_CURRENCY_CHANGED_EVENT, {
      detail: { currency },
    }),
  );
}
