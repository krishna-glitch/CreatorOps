import { createHash } from "node:crypto";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { idempotencyKeys } from "@/server/infrastructure/database/schema/idempotencyKeys";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function isIdempotencyInfraError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("idempotency_keys") ||
    error.message.includes('relation "idempotency_keys" does not exist')
  );
}

const baseHandler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return baseHandler(req);
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (!idempotencyKey) {
    return baseHandler(req);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return baseHandler(req);
  }

  const bodyText = await req.clone().text();
  const requestHash = createHash("sha256").update(bodyText).digest("hex");
  const url = new URL(req.url);
  const endpoint = `${url.pathname}${url.search}`;
  const now = new Date();

  let inserted: Array<{ id: string }> = [];
  try {
    inserted = await db
      .insert(idempotencyKeys)
      .values({
        userId: user.id,
        endpoint,
        key: idempotencyKey,
        requestHash,
        state: "IN_PROGRESS",
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });
  } catch (error) {
    if (isIdempotencyInfraError(error)) {
      return baseHandler(req);
    }
    throw error;
  }

  if (inserted.length === 0) {
    let existing: Awaited<
      ReturnType<typeof db.query.idempotencyKeys.findFirst>
    >;
    try {
      existing = await db.query.idempotencyKeys.findFirst({
        where: and(
          eq(idempotencyKeys.userId, user.id),
          eq(idempotencyKeys.endpoint, endpoint),
          eq(idempotencyKeys.key, idempotencyKey),
          gt(idempotencyKeys.expiresAt, now),
        ),
      });
    } catch (error) {
      if (isIdempotencyInfraError(error)) {
        return baseHandler(req);
      }
      throw error;
    }

    if (!existing) {
      return new Response(
        JSON.stringify({
          error: "IDEMPOTENCY_RECORD_NOT_FOUND",
          message: "Previous idempotency state expired. Retry with a new key.",
        }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (existing.requestHash !== requestHash) {
      return new Response(
        JSON.stringify({
          error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
        }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      existing.state === "COMPLETED" &&
      existing.responseStatus !== null &&
      existing.responseStatus !== undefined
    ) {
      return new Response(existing.responseBody ?? "", {
        status: existing.responseStatus,
        headers: {
          "content-type":
            existing.responseContentType ?? "application/json; charset=utf-8",
          "x-idempotency-replayed": "1",
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
        message: "Matching request is already processing. Retry shortly.",
      }),
      {
        status: 409,
        headers: {
          "content-type": "application/json",
          "retry-after": "2",
        },
      },
    );
  }

  const recordId = inserted[0]?.id;

  try {
    const response = await baseHandler(req);
    const responseBody = await response.clone().text();
    const responseContentType =
      response.headers.get("content-type") ?? "application/json; charset=utf-8";

    if (recordId) {
      if (response.status < 500) {
        await db
          .update(idempotencyKeys)
          .set({
            state: "COMPLETED",
            responseStatus: response.status,
            responseBody,
            responseContentType,
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          })
          .where(eq(idempotencyKeys.id, recordId));
      } else {
        await db
          .delete(idempotencyKeys)
          .where(eq(idempotencyKeys.id, recordId));
      }
    }

    return response;
  } catch (error) {
    if (recordId) {
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, recordId));
    }
    throw error;
  }
};

export { handler as GET, handler as POST };
