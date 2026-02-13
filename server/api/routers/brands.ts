import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const listBrandsForUser = (userId: string, db: typeof import("@/db").db) => {
  return db
    .select({
      id: brands.id,
      name: brands.name,
    })
    .from(brands)
    .where(eq(brands.userId, userId));
};

export const brandsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listBrandsForUser(ctx.user.id, ctx.db);
  }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return listBrandsForUser(ctx.user.id, ctx.db);
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [created] = await ctx.db
          .insert(brands)
          .values({
            userId: ctx.user.id,
            name: input.name,
          })
          .returning({
            id: brands.id,
            name: brands.name,
          });

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
});
