import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { extractDealFromMessage } from "@/src/server/services/ai/extractDeal";
import { parseDealFromMessage } from "@/src/server/services/parser/dealParser";
import { getAIExtractionAvailability } from "@/src/server/services/ai/quotaFlag";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { exclusivityRules } from "@/server/infrastructure/database/schema/exclusivity";
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
  revision_limit: z.number().int().min(1).max(20).default(2),
  exclusivity_rules: z
    .array(
      z
        .object({
          category_path: z.string().trim().min(1).max(200),
          scope: z.enum(["EXACT_CATEGORY", "PARENT_CATEGORY"]),
          start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          platforms: z
            .array(z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"]))
            .min(1)
            .max(3),
          regions: z
            .array(z.enum(["US", "IN", "GLOBAL"]))
            .min(1)
            .max(3)
            .default(["GLOBAL"]),
          notes: z.string().trim().max(1000).optional(),
        })
        .refine(
          (value) => new Date(value.end_date).getTime() > new Date(value.start_date).getTime(),
          {
            message: "End date must be after start date",
            path: ["end_date"],
          },
        ),
    )
    .default([]),
});

const updateDealInputSchema = createDealInputSchema.extend({
  id: z.string().uuid(),
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

const smartParseInputSchema = z.object({
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
          exclusivityRules: {
            columns: {
              id: true,
              categoryPath: true,
              scope: true,
              startDate: true,
              endDate: true,
              platforms: true,
              regions: true,
              notes: true,
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
      const availability = getAIExtractionAvailability();
      if (!availability.enabled) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "AI extraction is temporarily disabled due to quota. Please use manual form.",
        });
      }

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

        const availabilityAfterFailure = getAIExtractionAvailability();
        if (!availabilityAfterFailure.enabled) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "AI extraction hit quota and is temporarily disabled. Please use manual form.",
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
  smartParse: protectedProcedure
    .input(smartParseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userBrands = await ctx.db.query.brands.findMany({
        where: eq(brands.userId, ctx.user.id),
        columns: { name: true },
      });

      const brandNames = userBrands.map((b) => b.name);
      return parseDealFromMessage(input.message, brandNames);
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

        const created = await ctx.db.transaction(async (tx) => {
          const [newDeal] = await tx
            .insert(deals)
            .values({
              userId: ctx.user.id,
              brandId: input.brand_id,
              title: input.title,
              totalValue: input.total_value.toString(),
              currency: input.currency,
              status: input.status,
              revisionLimit: input.revision_limit,
              revisionsUsed: 0,
            })
            .returning({
              id: deals.id,
            });

          if (!newDeal) {
            return null;
          }

          if (input.exclusivity_rules.length > 0) {
            await tx.insert(exclusivityRules).values(
              input.exclusivity_rules.map((rule) => ({
                dealId: newDeal.id,
                categoryPath: rule.category_path,
                scope: rule.scope,
                startDate: rule.start_date,
                endDate: rule.end_date,
                platforms: rule.platforms,
                regions: rule.regions,
                notes: rule.notes ?? null,
              })),
            );
          }

          const createdDeal = await tx.query.deals.findFirst({
            where: and(eq(deals.id, newDeal.id), eq(deals.userId, ctx.user.id)),
            with: {
              brand: {
                columns: {
                  id: true,
                  name: true,
                },
              },
              exclusivityRules: {
                columns: {
                  id: true,
                  categoryPath: true,
                  scope: true,
                  startDate: true,
                  endDate: true,
                  platforms: true,
                  regions: true,
                  notes: true,
                },
              },
            },
          });

          return createdDeal ?? null;
        });

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create deal",
          });
        }

        console.log("[audit] deal.created", {
          userId: ctx.user.id,
          dealId: created.id,
          brandId: created.brandId,
          status: created.status,
          createdAt: new Date().toISOString(),
        });

        return created;
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
  update: protectedProcedure
    .input(updateDealInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
          columns: { id: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        const brand = await ctx.db.query.brands.findFirst({
          where: and(eq(brands.id, input.brand_id), eq(brands.userId, ctx.user.id)),
          columns: { id: true },
        });

        if (!brand) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found",
          });
        }

        await ctx.db.transaction(async (tx) => {
          await tx
            .update(deals)
            .set({
              brandId: input.brand_id,
              title: input.title,
              totalValue: input.total_value.toString(),
              currency: input.currency,
              status: input.status,
              revisionLimit: input.revision_limit,
              updatedAt: new Date(),
            })
            .where(and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)));

          await tx.delete(exclusivityRules).where(eq(exclusivityRules.dealId, input.id));

          if (input.exclusivity_rules.length > 0) {
            await tx.insert(exclusivityRules).values(
              input.exclusivity_rules.map((rule) => ({
                dealId: input.id,
                categoryPath: rule.category_path,
                scope: rule.scope,
                startDate: rule.start_date,
                endDate: rule.end_date,
                platforms: rule.platforms,
                regions: rule.regions,
                notes: rule.notes ?? null,
              })),
            );
          }
        });

        const updatedDeal = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
          with: {
            brand: {
              columns: {
                id: true,
                name: true,
              },
            },
            exclusivityRules: {
              columns: {
                id: true,
                categoryPath: true,
                scope: true,
                startDate: true,
                endDate: true,
                platforms: true,
                regions: true,
                notes: true,
              },
            },
          },
        });

        if (!updatedDeal) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to load updated deal",
          });
        }

        console.log("[audit] deal.updated", {
          userId: ctx.user.id,
          dealId: updatedDeal.id,
          brandId: updatedDeal.brandId,
          status: updatedDeal.status,
          updatedAt: new Date().toISOString(),
        });

        return updatedDeal;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const wrappedError =
          error instanceof Error
            ? new DatabaseError("deals.update", error)
            : new DatabaseError("deals.update");

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not update deal",
          cause: wrappedError,
        });
      }
    }),
});
