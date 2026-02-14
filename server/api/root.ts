/**
 * tRPC API Root Router
 *
 * This is the primary router for your tRPC API.
 * All routers should be imported and added here.
 */

import { aiRouter } from "./routers/ai";
import { analyticsRouter } from "./routers/analytics";
import { brandsRouter } from "./routers/brands";
import { conflictsRouter } from "./routers/conflicts";
import { dealsRouter } from "./routers/deals";
import { deliverablesRouter } from "./routers/deliverables";
import { feedbackRouter } from "./routers/feedback";
import { jobsRouter } from "./routers/jobs";
import { paymentsRouter } from "./routers/payments";
import { remindersRouter } from "./routers/reminders";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  ai: aiRouter,
  analytics: analyticsRouter,
  brand: brandsRouter,
  brands: brandsRouter,
  conflicts: conflictsRouter,
  deals: dealsRouter,
  deliverables: deliverablesRouter,
  feedback: feedbackRouter,
  jobs: jobsRouter,
  payments: paymentsRouter,
  reminders: remindersRouter,
});

export type AppRouter = typeof appRouter;
