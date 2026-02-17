import { format } from "date-fns";
import { z } from "zod";
import { isRedisConfigured, redis } from "@/server/infrastructure/cache/redis";
import { ExternalServiceError } from "@/server/utils/errors";
import logger from "@/server/utils/logger";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "INR",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "SGD",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface ExchangeRateResult {
  rate: number;
  date: string;
  source: "frankfurter" | "cache";
}

export interface ConversionResult {
  amountUsd: number;
  exchangeRate: number;
  exchangeRateDate: Date;
  exchangeRateSource: "frankfurter" | "cache";
}

const FrankfurterResponseSchema = z.object({
  amount: z.number(),
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

interface CachedExchangeRate {
  rate: number;
  date: string;
}

function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const cause = "cause" in error ? error.cause : undefined;
  return cause instanceof Error
    ? cause.name === "AbortError" || cause.name === "TimeoutError"
    : false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchFrankfurterRate(
  from: SupportedCurrency,
  to: SupportedCurrency,
  dateStr: string,
): Promise<ExchangeRateResult> {
  const url = `https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "CreatorOps/1.0",
    },
  });

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new ExternalServiceError("Frankfurter API");
    }

    throw new Error(`Frankfurter API request failed: ${response.status}`);
  }

  const jsonData: unknown = await response.json();
  const data = FrankfurterResponseSchema.parse(jsonData);
  const rate = data.rates[to];

  if (!rate || rate <= 0) {
    throw new ExternalServiceError("Frankfurter API");
  }

  return {
    rate,
    date: data.date,
    source: "frankfurter",
  };
}

export async function getHistoricalRate(
  from: SupportedCurrency,
  to: SupportedCurrency,
  date: Date,
): Promise<ExchangeRateResult> {
  const dateStr = format(date, "yyyy-MM-dd");

  if (from === to) {
    return {
      rate: 1,
      date: dateStr,
      source: "cache",
    };
  }

  const cacheKey = `fx:${from}:${to}:${dateStr}`;

  if (isRedisConfigured) {
    try {
      const cached = await redis.get<CachedExchangeRate>(cacheKey);
      if (cached?.rate && cached.date) {
        logger.info("Exchange rate cache hit", {
          cacheKey,
          from,
          to,
          date: cached.date,
        });
        return {
          rate: cached.rate,
          date: cached.date,
          source: "cache",
        };
      }
    } catch (error) {
      logger.warn("Exchange rate cache read failed", {
        cacheKey,
        from,
        to,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const retryDelays = [0, 1000, 2000];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    try {
      if (retryDelays[attempt] > 0) {
        await sleep(retryDelays[attempt]);
      }

      const result = await fetchFrankfurterRate(from, to, dateStr);

      if (isRedisConfigured) {
        const cachedPayload: CachedExchangeRate = {
          rate: result.rate,
          date: result.date,
        };

        const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
        try {
          if (isToday) {
            await redis.set(cacheKey, cachedPayload, { ex: 3600 });
          } else {
            await redis.set(cacheKey, cachedPayload);
          }
        } catch (error) {
          logger.warn("Exchange rate cache write failed", {
            cacheKey,
            from,
            to,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    } catch (error) {
      lastError = error;

      if (error instanceof z.ZodError) {
        throw new ExternalServiceError("Frankfurter API", error);
      }

      const shouldRetry =
        isNetworkError(error) && attempt < retryDelays.length - 1;

      logger.warn("Exchange rate fetch attempt failed", {
        from,
        to,
        dateStr,
        attempt: attempt + 1,
        shouldRetry,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!shouldRetry) {
        if (error instanceof ExternalServiceError) {
          throw error;
        }

        throw new ExternalServiceError(
          "Frankfurter API",
          error instanceof Error ? error : undefined,
        );
      }
    }
  }

  throw new ExternalServiceError(
    "Frankfurter API",
    lastError instanceof Error ? lastError : undefined,
  );
}

export async function convertToUSD(
  amount: number,
  fromCurrency: string,
  date: Date,
): Promise<ConversionResult | null> {
  const normalizedCurrency = fromCurrency.toUpperCase();

  if (!isSupportedCurrency(normalizedCurrency)) {
    logger.warn("Unsupported currency for conversion", {
      fromCurrency,
      normalizedCurrency,
    });
    return null;
  }

  if (normalizedCurrency === "USD") {
    return {
      amountUsd: Number(amount.toFixed(2)),
      exchangeRate: 1,
      exchangeRateDate: date,
      exchangeRateSource: "cache",
    };
  }

  try {
    const usdToCurrencyRate = await getHistoricalRate(
      "USD",
      normalizedCurrency,
      date,
    );
    const amountUsd = Number((amount / usdToCurrencyRate.rate).toFixed(2));

    return {
      amountUsd,
      exchangeRate: usdToCurrencyRate.rate,
      exchangeRateDate: new Date(usdToCurrencyRate.date),
      exchangeRateSource: usdToCurrencyRate.source,
    };
  } catch (error) {
    logger.warn("Currency conversion failed", {
      amount,
      fromCurrency: normalizedCurrency,
      date: date.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
