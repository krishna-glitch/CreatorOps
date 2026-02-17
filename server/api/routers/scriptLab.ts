import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { scriptLabFiles } from "@/server/infrastructure/database/schema/scriptLabFiles";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const scriptLabIdInput = z.object({ id: z.string().uuid() });

export const scriptLabRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.query.scriptLabFiles.findMany({
      where: eq(scriptLabFiles.userId, ctx.user.id),
      orderBy: [desc(scriptLabFiles.updatedAt)],
      columns: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  }),

  create: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(160),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [created] = await ctx.db
        .insert(scriptLabFiles)
        .values({
          id: input.id,
          userId: ctx.user.id,
          title: input.title,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create script file.",
        });
      }

      return created;
    }),

  getById: protectedProcedure
    .input(scriptLabIdInput)
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.query.scriptLabFiles.findFirst({
        where: and(
          eq(scriptLabFiles.id, input.id),
          eq(scriptLabFiles.userId, ctx.user.id),
        ),
      });

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script file not found.",
        });
      }

      return file;
    }),

  updateTitle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(scriptLabFiles)
        .set({ title: input.title, updatedAt: new Date() })
        .where(
          and(
            eq(scriptLabFiles.id, input.id),
            eq(scriptLabFiles.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script file not found.",
        });
      }

      return updated;
    }),

  saveContent: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        contentMarkdown: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(scriptLabFiles)
        .set({ contentMarkdown: input.contentMarkdown, updatedAt: new Date() })
        .where(
          and(
            eq(scriptLabFiles.id, input.id),
            eq(scriptLabFiles.userId, ctx.user.id),
          ),
        )
        .returning({
          id: scriptLabFiles.id,
          updatedAt: scriptLabFiles.updatedAt,
        });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script file not found.",
        });
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(scriptLabIdInput)
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(scriptLabFiles)
        .where(
          and(
            eq(scriptLabFiles.id, input.id),
            eq(scriptLabFiles.userId, ctx.user.id),
          ),
        )
        .returning({ id: scriptLabFiles.id });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script file not found.",
        });
      }

      return deleted;
    }),
});
