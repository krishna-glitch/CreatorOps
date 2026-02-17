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

function sanitize(input: unknown, max = 4000) {
  if (typeof input !== "string") return undefined;
  return input.length > max ? `${input.slice(0, max)}…` : input;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ClientErrorPayload;

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
