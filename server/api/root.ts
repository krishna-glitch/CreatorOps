/**
 * tRPC API Root Router
 *
 * This is the primary router for your tRPC API.
 * All routers should be imported and added here.
 */

import { aiRouter } from "./routers/ai";
import { brandsRouter } from "./routers/brands";
import { dealsRouter } from "./routers/deals";
import { deliverablesRouter } from "./routers/deliverables";
import { paymentsRouter } from "./routers/payments";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  ai: aiRouter,
  brand: brandsRouter,
  brands: brandsRouter,
  deals: dealsRouter,
  deliverables: deliverablesRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
