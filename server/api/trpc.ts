/**
 * tRPC Server Initialization
 *
 * This file contains:
 * 1. Context creation (access to database, session, etc.)
 * 2. tRPC initialization with SuperJSON transformer
 * 3. Reusable procedures (public, protected, etc.)
 * 4. Error formatting with Zod support
 */

import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "context" that is available in your API.
 * This allows you to access things like the database, session, etc.
 * when processing a request.
 */
export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  // Get the session from the request (we'll add auth later)
  // const session = await getServerSession();

  return {
    db,
    // session,
    headers: opts.req.headers,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer.
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
 * 3. ROUTER & PROCEDURE HELPERS
 *
 * These are helper functions you can use throughout your API.
 */

/**
 * Create a server-side router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing API requests
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // Log in development
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  if (t._config.isDev) {
    const end = Date.now();
    console.log(`[tRPC] ${path} took ${end - start}ms`);
  }

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API.
 * It does not guarantee that a user querying is authorized, but you can still access
 * user session data if they are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this.
 * It verifies the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @example
 * export const router = createTRPCRouter({
 *   getSecretMessage: protectedProcedure.query(() => {
 *     return "you can now see this secret message!";
 *   }),
 * });
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    // TODO: Add authentication check here
    // if (!ctx.session?.user) {
    //   throw new TRPCError({ code: 'UNAUTHORIZED' });
    // }

    return next({
      ctx: {
        ...ctx,
        // session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });
