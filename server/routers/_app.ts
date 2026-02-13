import { router } from "@/lib/trpc/init";

/**
 * Main tRPC router
 * Add your routers here
 */
export const appRouter = router({
  // Example: deals: dealsRouter,
  // Example: users: usersRouter,
});

export type AppRouter = typeof appRouter;
