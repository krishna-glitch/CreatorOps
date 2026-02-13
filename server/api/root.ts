/**
 * tRPC API Root Router
 *
 * This is the primary router for your tRPC API.
 * All routers should be imported and added here.
 */

import { brandsRouter } from "./routers/brands";
import { dealsRouter } from "./routers/deals";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  brand: brandsRouter,
  brands: brandsRouter,
  deals: dealsRouter,
});

export type AppRouter = typeof appRouter;
