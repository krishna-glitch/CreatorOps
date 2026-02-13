/**
 * tRPC API Root Router
 *
 * This is the primary router for your tRPC API.
 * All routers should be imported and added here.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./trpc";

/**
 * Example router - you can delete this once you have real routers
 */
const exampleRouter = createTRPCRouter({
  /**
   * Simple hello query
   * Test with: trpc.example.hello.useQuery({ name: "World" })
   */
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name ?? "World"}!`,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Get all items (example)
   */
  getAll: publicProcedure.query(() => {
    // Example: return ctx.db.select().from(items);
    return [
      { id: 1, name: "Example Item 1" },
      { id: 2, name: "Example Item 2" },
    ];
  }),

  /**
   * Create item (example mutation)
   */
  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => {
      // Example: return ctx.db.insert(items).values(input);
      return {
        id: Math.floor(Math.random() * 1000),
        name: input.name,
        createdAt: new Date(),
      };
    }),
});

/**
 * Main tRPC router
 *
 * Add your routers here:
 * @example
 * export const appRouter = createTRPCRouter({
 *   example: exampleRouter,
 *   users: usersRouter,
 *   deals: dealsRouter,
 * });
 */
export const appRouter = createTRPCRouter({
  example: exampleRouter,
  // Add your routers here
  // users: usersRouter,
  // deals: dealsRouter,
  // brands: brandsRouter,
});

/**
 * Export type definition of API
 * This is used by the client to get type safety
 */
export type AppRouter = typeof appRouter;
