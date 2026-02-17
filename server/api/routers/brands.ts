import { TRPCError } from "@trpc/server";
import { and, eq, gte, ilike, lt, or } from "drizzle-orm";
import { z } from "zod";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const listBrandsInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  cursor: z.string().datetime({ offset: true }).optional(),
  cursorId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

const getBrandByIdInputSchema = z.object({
  id: z.string().uuid(),
});

const createBrandInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const updateBrandInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

const deleteBrandInputSchema = z.object({
  id: z.string().uuid(),
});

export const brandsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listBrandsInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const search = input?.search?.trim() ?? "";
      const cursorDate = input?.cursor ? new Date(input.cursor) : null;
      const cursorId = input?.cursorId;

      const whereClause = and(
        eq(brands.userId, ctx.user.id),
        search.length > 0 ? ilike(brands.name, `%${search}%`) : undefined,
        (() => {
          if (!cursorDate) {
            return undefined;
          }

          if (!cursorId) {
            return lt(brands.createdAt, cursorDate);
          }

          const cursorNextMillisecond = new Date(cursorDate.getTime() + 1);

          return or(
            lt(brands.createdAt, cursorDate),
            and(
              gte(brands.createdAt, cursorDate),
              lt(brands.createdAt, cursorNextMillisecond),
              lt(brands.id, cursorId),
            ),
          );
        })(),
      );

      const results = await ctx.db.query.brands.findMany({
        where: whereClause,
        orderBy: (brandsTable, { desc }) => [
          desc(brandsTable.createdAt),
          desc(brandsTable.id),
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
    .input(getBrandByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const brand = await ctx.db.query.brands.findFirst({
        where: and(eq(brands.id, input.id), eq(brands.userId, ctx.user.id)),
      });

      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found",
        });
      }

      return brand;
    }),

  create: protectedProcedure
    .input(createBrandInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [created] = await ctx.db
          .insert(brands)
          .values({
            userId: ctx.user.id,
            name: input.name,
          })
          .returning();

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create brand",
          });
        }

        return created;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create brand",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(updateBrandInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(brands)
          .set({
            name: input.name,
            updatedAt: new Date(),
          })
          .where(and(eq(brands.id, input.id), eq(brands.userId, ctx.user.id)))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found",
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not update brand",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(deleteBrandInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db.transaction(async (tx) => {
          const linkedDeals = await tx.query.deals.findFirst({
            where: and(eq(deals.brandId, input.id), eq(deals.userId, ctx.user.id)),
            columns: { id: true },
          });

          if (linkedDeals) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot delete a brand with associated deals.",
            });
          }

          return tx
            .delete(brands)
            .where(and(eq(brands.id, input.id), eq(brands.userId, ctx.user.id)))
            .returning({
              id: brands.id,
              name: brands.name,
            });
        });

        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found",
          });
        }

        return deleted;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete brand",
          cause: error,
        });
      }
    }),
});
