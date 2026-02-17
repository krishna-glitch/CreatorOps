import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { mediaAssets } from "@/server/infrastructure/database/schema/media_assets";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const scriptVersionSchema = z.object({
  version: z.number().int().positive(),
  content: z.string(),
  saved_at: z.string().datetime({ offset: true }),
  word_count: z.number().int().nonnegative(),
});

function countWords(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function keepLast10<T>(items: T[]) {
  if (items.length <= 10) {
    return items;
  }
  return items.slice(items.length - 10);
}

const getScriptVersionsInput = z.object({
  scriptId: z.string().uuid(),
});

const saveScriptVersionInput = z.object({
  scriptId: z.string().uuid(),
  content: z.string(),
});

const restoreScriptVersionInput = z.object({
  scriptId: z.string().uuid(),
  version: z.number().int().positive(),
});

const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1GB free tier
const STORAGE_USAGE_FALLBACK = {
  totalBytesUsed: 0,
  storageLimitBytes: STORAGE_LIMIT_BYTES,
  percentUsed: 0,
  approachingLimit: false,
} as const;

function extractPgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeCode =
    "code" in error && typeof error.code === "string" ? error.code : null;
  if (maybeCode) {
    return maybeCode;
  }

  const nestedCause = "cause" in error ? error.cause : null;
  return extractPgErrorCode(nestedCause);
}

export const mediaAssetsRouter = createTRPCRouter({
  storageUsage: protectedProcedure.query(async ({ ctx }) => {
    try {
      const [result] = await ctx.db
        .select({
          totalBytes: sql<number>`COALESCE(SUM(${mediaAssets.fileSizeBytes}), 0)::bigint`,
        })
        .from(mediaAssets)
        .innerJoin(deliverables, eq(mediaAssets.deliverableId, deliverables.id))
        .innerJoin(deals, eq(deliverables.dealId, deals.id))
        .where(eq(deals.userId, ctx.user.id));

      const totalBytesUsed = Number(result?.totalBytes ?? 0);
      const percentUsed = Math.min(
        100,
        Math.round((totalBytesUsed / STORAGE_LIMIT_BYTES) * 100),
      );

      return {
        totalBytesUsed,
        storageLimitBytes: STORAGE_LIMIT_BYTES,
        percentUsed,
        approachingLimit: percentUsed >= 80,
      };
    } catch (error) {
      const pgCode = extractPgErrorCode(error);
      if (pgCode === "42P01") {
        return STORAGE_USAGE_FALLBACK;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not load storage usage right now.",
        cause: error,
      });
    }
  }),

  getScriptVersions: protectedProcedure
    .input(getScriptVersionsInput)
    .query(async ({ ctx, input }) => {
      const scriptAsset = await ctx.db.query.mediaAssets.findFirst({
        where: and(
          eq(mediaAssets.id, input.scriptId),
          eq(mediaAssets.assetType, "SCRIPT"),
        ),
        with: {
          deliverable: {
            with: {
              deal: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!scriptAsset || scriptAsset.deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script not found",
        });
      }

      const versionHistory = scriptVersionSchema
        .array()
        .parse(scriptAsset.versionHistory);

      return {
        scriptId: scriptAsset.id,
        content: scriptAsset.scriptContent ?? "",
        versionHistory: [...versionHistory].sort(
          (a, b) => b.version - a.version,
        ),
        versionNumber: scriptAsset.versionNumber,
        updatedAt: scriptAsset.updatedAt,
      };
    }),

  saveScriptVersion: protectedProcedure
    .input(saveScriptVersionInput)
    .mutation(async ({ ctx, input }) => {
      const scriptAsset = await ctx.db.query.mediaAssets.findFirst({
        where: and(
          eq(mediaAssets.id, input.scriptId),
          eq(mediaAssets.assetType, "SCRIPT"),
        ),
        with: {
          deliverable: {
            with: {
              deal: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!scriptAsset || scriptAsset.deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script not found",
        });
      }

      const existingHistory = scriptVersionSchema
        .array()
        .parse(scriptAsset.versionHistory);
      const latestVersion = existingHistory[existingHistory.length - 1];
      const now = new Date();
      const nowIso = now.toISOString();

      if (latestVersion?.content === input.content) {
        const [unchanged] = await ctx.db
          .update(mediaAssets)
          .set({
            scriptContent: input.content,
            updatedAt: now,
          })
          .where(eq(mediaAssets.id, input.scriptId))
          .returning();

        if (!unchanged) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save script",
          });
        }

        return {
          scriptId: unchanged.id,
          content: unchanged.scriptContent ?? "",
          savedAt: nowIso,
          versionNumber: unchanged.versionNumber,
          versionHistory: [...existingHistory].sort(
            (a, b) => b.version - a.version,
          ),
        };
      }

      const nextVersion =
        Math.max(scriptAsset.versionNumber, latestVersion?.version ?? 0) + 1;
      const nextVersionEntry = {
        version: nextVersion,
        content: input.content,
        saved_at: nowIso,
        word_count: countWords(input.content),
      };
      const nextHistory = keepLast10([...existingHistory, nextVersionEntry]);

      const [updated] = await ctx.db
        .update(mediaAssets)
        .set({
          scriptContent: input.content,
          versionNumber: nextVersion,
          versionHistory: nextHistory,
          updatedAt: now,
        })
        .where(eq(mediaAssets.id, input.scriptId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save script",
        });
      }

      return {
        scriptId: updated.id,
        content: updated.scriptContent ?? "",
        savedAt: nowIso,
        versionNumber: updated.versionNumber,
        versionHistory: [...nextHistory].sort((a, b) => b.version - a.version),
      };
    }),

  restoreScriptVersion: protectedProcedure
    .input(restoreScriptVersionInput)
    .mutation(async ({ ctx, input }) => {
      const scriptAsset = await ctx.db.query.mediaAssets.findFirst({
        where: and(
          eq(mediaAssets.id, input.scriptId),
          eq(mediaAssets.assetType, "SCRIPT"),
        ),
        with: {
          deliverable: {
            with: {
              deal: {
                columns: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!scriptAsset || scriptAsset.deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script not found",
        });
      }

      const existingHistory = scriptVersionSchema
        .array()
        .parse(scriptAsset.versionHistory);
      const targetVersion = existingHistory.find(
        (entry) => entry.version === input.version,
      );

      if (!targetVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const nextVersion =
        Math.max(
          scriptAsset.versionNumber,
          ...existingHistory.map((entry) => entry.version),
        ) + 1;
      const restoredEntry = {
        version: nextVersion,
        content: targetVersion.content,
        saved_at: nowIso,
        word_count: countWords(targetVersion.content),
      };
      const nextHistory = keepLast10([...existingHistory, restoredEntry]);

      const [updated] = await ctx.db
        .update(mediaAssets)
        .set({
          scriptContent: targetVersion.content,
          versionNumber: nextVersion,
          versionHistory: nextHistory,
          updatedAt: now,
        })
        .where(eq(mediaAssets.id, input.scriptId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restore script version",
        });
      }

      return {
        scriptId: updated.id,
        content: updated.scriptContent ?? "",
        restoredFromVersion: input.version,
        versionNumber: updated.versionNumber,
        versionHistory: [...nextHistory].sort((a, b) => b.version - a.version),
        savedAt: nowIso,
      };
    }),
});
