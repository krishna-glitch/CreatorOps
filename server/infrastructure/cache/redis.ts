import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

if (!redisUrl || !redisToken) {
  // Warn but don't crash, allowing app to run without cache in dev if needed
  console.warn(
    "⚠️ UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not set. Caching will be disabled.",
  );
}

export const isRedisConfigured = Boolean(redisUrl && redisToken);

export const redis = new Redis({
  url: redisUrl || "https://invalid.upstash.local",
  token: redisToken || "disabled",
});

export const CACHE_TTL = {
  SHORT: 60 * 5, // 5 minutes
  MEDIUM: 60 * 60, // 1 hour
  LONG: 60 * 60 * 24, // 1 day
};
