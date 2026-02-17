import { TRPCError } from "@trpc/server";
import { and, eq, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { exclusivityRules } from "@/server/infrastructure/database/schema/exclusivity";
import { payments } from "@/server/infrastructure/database/schema/payments";
import {
  DatabaseError,
  ExternalServiceError,
  ValidationError,
} from "@/server/utils/errors";
import { extractDealFromMessage } from "@/src/server/services/ai/extractDeal";
import { getAIExtractionAvailability } from "@/src/server/services/ai/quotaFlag";
import { parseDealFromMessage } from "@/src/server/services/parser/dealParser";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const dealStatusSchema = z.enum([
  "INBOUND",
  "NEGOTIATING",
  "AGREED",
  "POSTED",
  "PAID",
  "CANCELLED",
  "REJECTED",
]);

const dealCompensationModelSchema = z.enum(["FIXED", "AFFILIATE", "HYBRID"]);

const createDealInputSchema = z
  .object({
    brand_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    total_value: z.number().positive().finite(),
    currency: z.enum(["USD", "INR"]),
    status: dealStatusSchema,
    compensation_model: dealCompensationModelSchema.default("FIXED"),
    cash_percent: z.number().int().min(0).max(100).default(100),
    affiliate_percent: z.number().int().min(0).max(100).default(0),
    guaranteed_cash_value: z.number().nonnegative().finite().optional(),
    expected_affiliate_value: z.number().nonnegative().finite().optional(),
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
            (value) =>
              new Date(value.end_date).getTime() >
              new Date(value.start_date).getTime(),
            {
              message: "End date must be after start date",
              path: ["end_date"],
            },
          ),
      )
      .default([]),
  })
  .superRefine((input, ctx) => {
    if (input.cash_percent + input.affiliate_percent !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cash_percent"],
        message: "Cash and affiliate percentages must add up to 100.",
      });
    }

    if (
      input.compensation_model === "FIXED" &&
      (input.cash_percent !== 100 || input.affiliate_percent !== 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensation_model"],
        message: "FIXED deals must be 100% cash.",
      });
    }

    if (
      input.compensation_model === "AFFILIATE" &&
      (input.cash_percent !== 0 || input.affiliate_percent !== 100)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensation_model"],
        message: "AFFILIATE deals must be 100% affiliate.",
      });
    }

    if (
      input.compensation_model === "HYBRID" &&
      (input.cash_percent <= 0 || input.affiliate_percent <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensation_model"],
        message: "HYBRID deals must include both cash and affiliate shares.",
      });
    }
  });

const updateDealInputSchema = createDealInputSchema.extend({
  id: z.string().uuid(),
});

const updateDealStatusInputSchema = z.object({
  id: z.string().uuid(),
  status: dealStatusSchema,
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

type DbTx = Parameters<
  Parameters<typeof import("@/db")["db"]["transaction"]>[0]
>[0];

function getCreateDealDatabaseError(error: unknown): TRPCError {
  const pgCode = extractPgErrorCode(error);

  if (pgCode === "42703" || pgCode === "42P01") {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Database schema is out of date. Please run the latest database migrations and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.create", error)
          : new DatabaseError("deals.create"),
    });
  }

  if (pgCode === "23503") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid related record reference. Please refresh and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.create", error)
          : new DatabaseError("deals.create"),
    });
  }

  if (pgCode === "23514") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "One or more values violate deal constraints. Please review the form values.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.create", error)
          : new DatabaseError("deals.create"),
    });
  }

  if (pgCode === "22P02") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "A field has an invalid format. Please review your inputs and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.create", error)
          : new DatabaseError("deals.create"),
    });
  }

  console.error("[deals.create] unexpected database error", {
    code: pgCode,
    error: error instanceof Error ? error.message : String(error),
  });

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not create deal right now. Please try again in a moment.",
    cause:
      error instanceof Error
        ? new DatabaseError("deals.create", error)
        : new DatabaseError("deals.create"),
  });
}

function extractPgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  if (code) {
    return code;
  }

  const nestedCause = "cause" in error ? error.cause : null;
  return extractPgErrorCode(nestedCause);
}

function getUpdateDealDatabaseError(error: unknown): TRPCError {
  const pgCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;
  const pgMessage =
    error instanceof Error ? error.message : "Unknown database error";

  if (pgCode === "42703" || pgCode === "42P01") {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Database schema is out of date. Please run the latest database migrations and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.update", error)
          : new DatabaseError("deals.update"),
    });
  }

  if (pgCode === "23503") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid related record reference. Please refresh and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.update", error)
          : new DatabaseError("deals.update"),
    });
  }

  if (pgCode === "23514") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "One or more values violate deal constraints. Please review the form values.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.update", error)
          : new DatabaseError("deals.update"),
    });
  }

  if (pgCode === "22P02") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message:
        "A field has an invalid format. Please review your inputs and try again.",
      cause:
        error instanceof Error
          ? new DatabaseError("deals.update", error)
          : new DatabaseError("deals.update"),
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not update deal: ${pgMessage}`,
    cause:
      error instanceof Error
        ? new DatabaseError("deals.update", error)
        : new DatabaseError("deals.update"),
  });
}

async function syncPaymentsForDealStatus(params: {
  tx: DbTx;
  dealId: string;
  dealTotalValue: string;
  dealCurrency: "USD" | "INR";
  nextStatus: z.infer<typeof dealStatusSchema>;
  previousStatus: string | null;
}) {
  const {
    tx,
    dealId,
    dealTotalValue,
    dealCurrency,
    nextStatus,
    previousStatus,
  } = params;
  type PaymentSyncRow = {
    id: string;
    status: string | null;
    paidAt: Date | null;
  };

  if (nextStatus === "PAID") {
    const now = new Date();
    const existingPayments: PaymentSyncRow[] = await tx.query.payments.findMany(
      {
        where: eq(payments.dealId, dealId),
        columns: {
          id: true,
          status: true,
          paidAt: true,
        },
      },
    );

    if (existingPayments.length === 0) {
      await tx.insert(payments).values({
        dealId,
        amount: dealTotalValue,
        currency: dealCurrency,
        kind: "FINAL",
        status: "PAID",
        paidAt: now,
      });
    } else {
      const paymentIdsToMarkPaid = existingPayments
        .filter(
          (payment: PaymentSyncRow) =>
            payment.status !== "PAID" || payment.paidAt === null,
        )
        .map((payment: PaymentSyncRow) => payment.id);

      if (paymentIdsToMarkPaid.length > 0) {
        await Promise.all(
          paymentIdsToMarkPaid.map((paymentId: string) =>
            tx
              .update(payments)
              .set({
                status: "PAID",
                paidAt: now,
                updatedAt: now,
              })
              .where(eq(payments.id, paymentId)),
          ),
        );
      }
    }
    return;
  }

  if (previousStatus === "PAID") {
    const now = new Date();
    const paidRows: PaymentSyncRow[] = await tx.query.payments.findMany({
      where: eq(payments.dealId, dealId),
      columns: {
        id: true,
        status: true,
        paidAt: true,
      },
    });

    const paymentIdsToReset = paidRows
      .filter(
        (payment: PaymentSyncRow) =>
          payment.status === "PAID" || payment.paidAt !== null,
      )
      .map((payment: PaymentSyncRow) => payment.id);

    if (paymentIdsToReset.length > 0) {
      await Promise.all(
        paymentIdsToReset.map((paymentId: string) =>
          tx
            .update(payments)
            .set({
              status: "EXPECTED",
              paidAt: null,
              updatedAt: now,
            })
            .where(eq(payments.id, paymentId)),
        ),
      );
    }
  }
}

export const dealsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listDealsInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursorDate = input?.cursor ? new Date(input.cursor) : null;
      const cursorId = input?.cursorId;

      const results = await ctx.db.query.deals.findMany({
        where: and(
          eq(deals.userId, ctx.user.id),
          (() => {
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
          })(),
        ),
        with: {
          brand: {
            columns: {
              id: true,
              name: true,
            },
          },
          deliverables: {
            columns: {
              id: true,
              scheduledAt: true,
              postedAt: true,
              status: true,
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
          ? (items[items.length - 1]?.createdAt.toISOString() ?? null)
          : null;
      const nextCursorId =
        hasMore && items.length > 0
          ? (items[items.length - 1]?.id ?? null)
          : null;

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
              compensationModel: input.compensation_model,
              cashPercent: input.cash_percent,
              affiliatePercent: input.affiliate_percent,
              guaranteedCashValue:
                input.guaranteed_cash_value?.toString() ?? null,
              expectedAffiliateValue:
                input.expected_affiliate_value?.toString() ?? null,
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

          await syncPaymentsForDealStatus({
            tx,
            dealId: newDeal.id,
            dealTotalValue: input.total_value.toString(),
            dealCurrency: input.currency,
            nextStatus: input.status,
            previousStatus: null,
          });

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

        throw getCreateDealDatabaseError(error);
      }
    }),
  update: protectedProcedure
    .input(updateDealInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
          columns: { id: true, status: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        const brand = await ctx.db.query.brands.findFirst({
          where: and(
            eq(brands.id, input.brand_id),
            eq(brands.userId, ctx.user.id),
          ),
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
              compensationModel: input.compensation_model,
              cashPercent: input.cash_percent,
              affiliatePercent: input.affiliate_percent,
              guaranteedCashValue:
                input.guaranteed_cash_value?.toString() ?? null,
              expectedAffiliateValue:
                input.expected_affiliate_value?.toString() ?? null,
              currency: input.currency,
              status: input.status,
              revisionLimit: input.revision_limit,
              updatedAt: new Date(),
            })
            .where(and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)));

          await tx
            .delete(exclusivityRules)
            .where(eq(exclusivityRules.dealId, input.id));

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

          await syncPaymentsForDealStatus({
            tx,
            dealId: input.id,
            dealTotalValue: input.total_value.toString(),
            dealCurrency: input.currency,
            nextStatus: input.status,
            previousStatus: existing.status,
          });
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

        throw getUpdateDealDatabaseError(error);
      }
    }),
  updateStatus: protectedProcedure
    .input(updateDealStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.db.transaction(async (tx) => {
          const existingDeal = await tx.query.deals.findFirst({
            where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
            columns: {
              id: true,
              status: true,
              totalValue: true,
              currency: true,
            },
          });

          if (!existingDeal) {
            return null;
          }

          const [updatedDeal] = await tx
            .update(deals)
            .set({
              status: input.status,
              updatedAt: new Date(),
            })
            .where(and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)))
            .returning({
              id: deals.id,
              status: deals.status,
            });

          if (!updatedDeal) {
            return null;
          }

          await syncPaymentsForDealStatus({
            tx,
            dealId: input.id,
            dealTotalValue: existingDeal.totalValue ?? "0",
            dealCurrency: existingDeal.currency === "INR" ? "INR" : "USD",
            nextStatus: input.status,
            previousStatus: existingDeal.status,
          });

          return updatedDeal;
        });

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        console.log("[audit] deal.status_updated", {
          userId: ctx.user.id,
          dealId: updated.id,
          status: updated.status,
          updatedAt: new Date().toISOString(),
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw getUpdateDealDatabaseError(error);
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)),
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        await ctx.db.transaction(async (tx) => {
          // Delete related records (cascade might handle this, but explicit is safer for some relations)
          await tx
            .delete(exclusivityRules)
            .where(eq(exclusivityRules.dealId, input.id));
          await tx.delete(payments).where(eq(payments.dealId, input.id));

          await tx
            .delete(deals)
            .where(and(eq(deals.id, input.id), eq(deals.userId, ctx.user.id)));
        });

        console.log("[audit] deal.deleted", {
          userId: ctx.user.id,
          dealId: input.id,
          deletedAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete deal",
          cause: error,
        });
      }
    }),
});
