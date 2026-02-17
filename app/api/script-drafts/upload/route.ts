import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { scriptLabFiles } from "@/server/infrastructure/database/schema/scriptLabFiles";

export const runtime = "nodejs";

async function handleUpload(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");
  if (!fileId) {
    return new Response("Missing fileId", { status: 400 });
  }

  const contentMarkdown = await request.text();

  const [updated] = await db
    .update(scriptLabFiles)
    .set({
      contentMarkdown,
      updatedAt: new Date(),
    })
    .where(
      and(eq(scriptLabFiles.id, fileId), eq(scriptLabFiles.userId, user.id)),
    )
    .returning({ id: scriptLabFiles.id });

  if (!updated) {
    return new Response("Script file not found", { status: 404 });
  }

  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  return handleUpload(request);
}

export async function PUT(request: Request) {
  return handleUpload(request);
}
