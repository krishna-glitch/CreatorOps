import { runCheckRemindersJob } from "@/src/server/jobs/checkReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await runCheckRemindersJob();
    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown cron job error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
