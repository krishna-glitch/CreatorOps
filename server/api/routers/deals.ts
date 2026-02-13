import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { DatabaseError } from "@/server/utils/errors";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const createDealInputSchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  total_value: z.number().positive().finite(),
  currency: z.enum(["USD", "INR"]),
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID"]),
});

export const dealsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createDealInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const brand = await ctx.db.query.brands.findFirst({
          where: and(
            eq(brands.id, input.brand_id),
            eq(brands.userId, ctx.user.id),
          ),
          columns: {
            id: true,
            name: true,
          },
        });

        if (!brand) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found",
          });
        }

        const [created] = await ctx.db
          .insert(deals)
          .values({
            userId: ctx.user.id,
            brandId: input.brand_id,
            title: input.title,
            totalValue: input.total_value.toString(),
            currency: input.currency,
            status: input.status,
          })
          .returning({
            id: deals.id,
          });

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create deal",
          });
        }

        const createdDeal = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, created.id), eq(deals.userId, ctx.user.id)),
          with: {
            brand: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!createdDeal) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to load created deal",
          });
        }

        console.log("[audit] deal.created", {
          userId: ctx.user.id,
          dealId: createdDeal.id,
          brandId: createdDeal.brandId,
          status: createdDeal.status,
          createdAt: new Date().toISOString(),
        });

        return createdDeal;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const wrappedError =
          error instanceof Error
            ? new DatabaseError("deals.create", error)
            : new DatabaseError("deals.create");

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create deal",
          cause: wrappedError,
        });
      }
    }),
});
