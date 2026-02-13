import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { extractDealFromMessage } from "@/src/server/services/ai/extractDeal";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import {
  DatabaseError,
  ExternalServiceError,
  ValidationError,
} from "@/server/utils/errors";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const createDealInputSchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  total_value: z.number().positive().finite(),
  currency: z.enum(["USD", "INR"]),
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID"]),
});

const listDealsInputSchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  cursorId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const getDealByIdInputSchema = z.object({
  id: z.string().uuid(),
});

const parseDealMessageInputSchema = z.object({
  message: z.string().trim().min(1).max(5000),
});

export const dealsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listDealsInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursorDate = input?.cursor ? new Date(input.cursor) : null;
      const cursorId = input?.cursorId;

      const results = await ctx.db.query.deals.findMany({
        where: and(eq(deals.userId, ctx.user.id), (() => {
          if (!cursorDate) {
            return undefined;
          }

          if (!cursorId) {
            return lt(deals.createdAt, cursorDate);
          }

          const cursorNextMillisecond = new Date(cursorDate.getTime() + 1);

          return or(
            lt(deals.createdAt, cursorDate),
            and(
              gte(deals.createdAt, cursorDate),
              lt(deals.createdAt, cursorNextMillisecond),
              lt(deals.id, cursorId),
            ),
          );
        })()),
        with: {
          brand: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: (dealsTable, { desc }) => [
          desc(dealsTable.createdAt),
          desc(dealsTable.id),
        ],
        limit: limit + 1,
      });

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, -1) : results;
      const nextCursor =
        hasMore && items.length > 0
          ? items[items.length - 1]?.createdAt.toISOString() ?? null
          : null;
      const nextCursorId =
        hasMore && items.length > 0 ? items[items.length - 1]?.id ?? null : null;

      return {
        items,
        nextCursor,
        nextCursorId,
        hasMore,
      };
    }),
  getById: protectedProcedure
    .input(getDealByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
        with: {
          brand: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      return deal;
    }),
  parseMessage: protectedProcedure
    .input(parseDealMessageInputSchema)
    .mutation(async ({ input }) => {
      try {
        return await extractDealFromMessage(input.message);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }

        const wrappedError =
          error instanceof ExternalServiceError
            ? error
            : new ExternalServiceError(
                "Groq",
                error instanceof Error ? error : undefined,
              );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not parse deal message",
          cause: wrappedError,
        });
      }
    }),
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
