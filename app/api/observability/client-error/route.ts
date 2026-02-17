export const runtime = "nodejs";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { clientErrorLogs } from "@/server/infrastructure/database/schema/clientErrorLogs";

type ClientErrorPayload = {
  type?: string;
  message?: string;
  stack?: string;
  digest?: string;
  pathname?: string;
  userAgent?: string;
};

const MAX_ERROR_PAYLOAD_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

function sanitize(input: unknown, max = 4000) {
  if (typeof input !== "string") return undefined;
  return input.length > max ? `${input.slice(0, max)}…` : input;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = rateLimitState.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  rateLimitState.set(ip, current);
  return false;
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  const expectedOrigin = `${protocol}://${host}`;
  return origin === expectedOrigin;
}

function isAdminUser(user: unknown) {
  const safeUser = user as {
    app_metadata?: { role?: unknown };
    user_metadata?: { role?: unknown };
  } | null;
  const roleFromApp = safeUser?.app_metadata?.role;
  const roleFromUser = safeUser?.user_metadata?.role;
  const role = typeof roleFromApp === "string" ? roleFromApp : roleFromUser;
  return role === "admin" || role === "ops";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json({ ok: false, error: "Too Many Requests" }, { status: 429 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_ERROR_PAYLOAD_BYTES) {
    return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_ERROR_PAYLOAD_BYTES) {
      return Response.json({ ok: false, error: "Payload Too Large" }, { status: 413 });
    }

    const payload = JSON.parse(rawBody) as ClientErrorPayload;

    const record = {
      type: sanitize(payload.type, 100) ?? "unknown",
      message: sanitize(payload.message) ?? "Unknown client error",
      stack: sanitize(payload.stack, 8000),
      pathname: sanitize(payload.pathname, 500),
      userAgent: sanitize(payload.userAgent, 1000),
      reportedAt: new Date(),
    };

    await db.insert(clientErrorLogs).values(record);
    console.error("[client-error]", {
      type: record.type,
      message: record.message,
      digest: sanitize(payload.digest, 200),
      pathname: record.pathname,
      reportedAt: record.reportedAt.toISOString(),
      stackPreview: record.stack?.split("\n")[0],
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[client-error] failed to parse payload", error);
    return Response.json({ ok: false }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(200, Math.trunc(rawLimit)))
    : 50;

  const logs = await db
    .select({
      id: clientErrorLogs.id,
      type: clientErrorLogs.type,
      message: clientErrorLogs.message,
      stack: clientErrorLogs.stack,
      pathname: clientErrorLogs.pathname,
      userAgent: clientErrorLogs.userAgent,
      reportedAt: clientErrorLogs.reportedAt,
      createdAt: clientErrorLogs.createdAt,
    })
    .from(clientErrorLogs)
    .orderBy(desc(clientErrorLogs.reportedAt))
    .limit(limit);

  return Response.json({ ok: true, count: logs.length, logs });
}
