"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY_CHANGED_EVENT,
  type DefaultCurrency,
  getStoredDefaultCurrency,
  setStoredDefaultCurrency,
} from "@/src/lib/preferences/defaultCurrency";

export function useDefaultCurrency() {
  const [defaultCurrency, setDefaultCurrencyState] = useState<DefaultCurrency>(
    "USD",
  );

  useEffect(() => {
    setDefaultCurrencyState(getStoredDefaultCurrency());

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === DEFAULT_CURRENCY_STORAGE_KEY) {
        setDefaultCurrencyState(getStoredDefaultCurrency());
      }
    };
    const onPreferenceChanged = () => {
      setDefaultCurrencyState(getStoredDefaultCurrency());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(DEFAULT_CURRENCY_CHANGED_EVENT, onPreferenceChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        DEFAULT_CURRENCY_CHANGED_EVENT,
        onPreferenceChanged,
      );
    };
  }, []);

  const setDefaultCurrency = (currency: DefaultCurrency) => {
    setStoredDefaultCurrency(currency);
    setDefaultCurrencyState(currency);
  };

  return { defaultCurrency, setDefaultCurrency };
}
