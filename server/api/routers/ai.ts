import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ExternalServiceError } from "@/server/utils/errors";
import { testGroqConnection } from "@/src/server/services/ai/client";
import { getAIExtractionAvailability } from "@/src/server/services/ai/quotaFlag";
import { createTRPCRouter, publicProcedure } from "../trpc";

const testConnectionInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default("Nike wants 2 reels for $1500"),
});

export const aiRouter = createTRPCRouter({
  extractionAvailability: publicProcedure.query(() => {
    return getAIExtractionAvailability();
  }),
  testConnection: publicProcedure
    .input(testConnectionInputSchema.optional())
    .query(async ({ input }) => {
      try {
        const result = await testGroqConnection(
          input?.message ?? "Nike wants 2 reels for $1500",
        );

        return {
          ok: true,
          ...result,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
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
          message: "Groq connection test failed",
          cause: wrappedError,
        });
      }
    }),
});
