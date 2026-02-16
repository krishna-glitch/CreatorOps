import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { idempotencyKeys } from "@/server/infrastructure/database/schema/idempotencyKeys";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";

/**
 * 1. CONTEXT
 */
export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    db,
    user,
    headers: opts.req.headers,
  };
};

/**
 * 2. INITIALIZATION
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Middleware for timing API requests
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();

  if (t._config.isDev) {
    const end = Date.now();
    console.log(`[tRPC] ${path} took ${end - start}ms`);
  }

  return result;
});

/**
 * Middleware for idempotency
 */
const idempotencyMiddleware = t.middleware(async ({ ctx, next, path, type, input }) => {
  const key = ctx.headers.get("x-idempotency-key");

  // Only apply to mutations that provide a key
  if (type !== "mutation" || !key || !ctx.user) {
    return next();
  }

  const userId = ctx.user.id;
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

  // 1. Check if key exists
  const existing = await ctx.db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.userId, userId),
      eq(idempotencyKeys.endpoint, path),
      eq(idempotencyKeys.key, key)
    ),
  });

  if (existing) {
    if (existing.state === "COMPLETED" && existing.responseBody) {
      // tRPC middleware must return a result from next() or throw
      // To return a cached result, we'd ideally throw a custom error or 
      // handle it at the procedure level. For now, we'll throw a specific error
      // that the client can handle, or just let it through if it's already done
      // but that risks double-execution if not careful.
      // High-quality way: throw a TRPCError with metadata
      throw new TRPCError({
        code: "CONFLICT",
        message: "IDEMPOTENT_REPLAY",
      });
    }
    
    if (existing.state === "IN_PROGRESS") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Request is already being processed",
      });
    }
  }

  // 2. Register key as IN_PROGRESS
  await ctx.db.insert(idempotencyKeys).values({
    userId,
    endpoint: path,
    key,
    requestHash,
    state: "IN_PROGRESS",
  });

  try {
    const result = await next();
    
    if (result.ok) {
      // 3. Update to COMPLETED
      await ctx.db
        .update(idempotencyKeys)
        .set({
          state: "COMPLETED",
          responseStatus: 200,
          responseBody: JSON.stringify(result.data),
        })
        .where(and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.endpoint, path),
          eq(idempotencyKeys.key, key)
        ));
    } else {
      // If result is not ok, cleanup
      await ctx.db
        .delete(idempotencyKeys)
        .where(and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.endpoint, path),
          eq(idempotencyKeys.key, key)
        ));
    }

    return result;
  } catch (error) {
    // 4. Cleanup on failure so user can try again
    await ctx.db
      .delete(idempotencyKeys)
      .where(and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.endpoint, path),
        eq(idempotencyKeys.key, key)
      ));
    throw error;
  }
});

/**
 * 3. ROUTER & PROCEDURE HELPERS
 */

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
  .use(idempotencyMiddleware);
