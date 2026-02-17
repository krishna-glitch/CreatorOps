import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { pushSubscriptions } from "@/server/infrastructure/database/schema/pushSubscriptions";
import {
  getPublicVapidKey,
  isWebPushConfigured,
} from "@/src/server/services/notifications/webPush";

const subscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const notificationsRouter = createTRPCRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    const subscriptions = await ctx.db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
      })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, ctx.user.id),
          eq(pushSubscriptions.isActive, true),
        ),
      );

    return {
      webPushConfigured: isWebPushConfigured(),
      vapidPublicKeyAvailable: Boolean(getPublicVapidKey()),
      activeSubscriptionCount: subscriptions.length,
      hasActiveSubscription: subscriptions.length > 0,
    };
  }),

  getVapidPublicKey: protectedProcedure.query(() => {
    return {
      publicKey: getPublicVapidKey(),
      configured: isWebPushConfigured(),
    };
  }),

  subscribe: protectedProcedure
    .input(subscriptionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const userAgent = ctx.headers.get("user-agent");

      await ctx.db
        .insert(pushSubscriptions)
        .values({
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent,
          isActive: true,
          updatedAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: ctx.user.id,
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            userAgent,
            isActive: true,
            updatedAt: now,
            lastSeenAt: now,
          },
        });

      return {
        ok: true,
      };
    }),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const whereClause = input.endpoint
        ? and(
            eq(pushSubscriptions.endpoint, input.endpoint),
            eq(pushSubscriptions.userId, ctx.user.id),
          )
        : eq(pushSubscriptions.userId, ctx.user.id);

      await ctx.db
        .update(pushSubscriptions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(whereClause);

      return {
        ok: true,
      };
    }),
});
