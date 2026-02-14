import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { payments } from "@/server/infrastructure/database/schema/payments";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const paymentCurrencySchema = z.enum(["USD", "INR", "OTHER"]);
const paymentKindSchema = z.enum(["DEPOSIT", "FINAL", "PARTIAL", "OTHER"]);
const paymentStatusSchema = z.enum(["EXPECTED", "PAID", "OVERDUE"]);
const paymentMethodSchema = z.enum([
  "PAYPAL",
  "WIRE",
  "VENMO",
  "ZELLE",
  "OTHER",
]);

const createPaymentInputSchema = z.object({
  deal_id: z.string().uuid(),
  amount: z.number().positive().finite(),
  currency: paymentCurrencySchema,
  kind: paymentKindSchema,
  status: paymentStatusSchema.default("EXPECTED"),
  expected_date: z.string().datetime({ offset: true }).nullable().optional(),
  paid_at: z.string().datetime({ offset: true }).nullable().optional(),
  payment_method: paymentMethodSchema.nullable().optional(),
});

const updatePaymentInputSchema = z
  .object({
    id: z.string().uuid(),
    amount: z.number().positive().finite().optional(),
    currency: paymentCurrencySchema.optional(),
    kind: paymentKindSchema.optional(),
    status: paymentStatusSchema.optional(),
    expected_date: z.string().datetime({ offset: true }).nullable().optional(),
    paid_at: z.string().datetime({ offset: true }).nullable().optional(),
    payment_method: paymentMethodSchema.nullable().optional(),
  })
  .refine(
    (input) =>
      input.amount !== undefined ||
      input.currency !== undefined ||
      input.kind !== undefined ||
      input.status !== undefined ||
      input.expected_date !== undefined ||
      input.paid_at !== undefined ||
      input.payment_method !== undefined,
    { message: "At least one field must be provided for update" },
  );

const markPaidInputSchema = z.object({
  id: z.string().uuid(),
  paid_at: z.string().datetime({ offset: true }).optional(),
  payment_method: paymentMethodSchema.optional(),
});

const listByDealInputSchema = z.object({
  deal_id: z.string().uuid(),
});

type PaymentStatus = z.infer<typeof paymentStatusSchema>;

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function calculatePaymentStatus(params: {
  paidAt?: Date | string | null;
  expectedDate?: Date | string | null;
}): PaymentStatus {
  if (params.paidAt) {
    return "PAID";
  }

  if (params.expectedDate) {
    const expectedDate =
      params.expectedDate instanceof Date
        ? params.expectedDate
        : new Date(params.expectedDate);

    if (!Number.isNaN(expectedDate.getTime()) && expectedDate < getTodayStart()) {
      return "OVERDUE";
    }
  }

  return "EXPECTED";
}

export const paymentsRouter = createTRPCRouter({
  listByDeal: protectedProcedure
    .input(listByDealInputSchema)
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
        columns: {
          id: true,
        },
      });

      if (!deal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deal not found",
        });
      }

      const paymentList = await ctx.db.query.payments.findMany({
        where: eq(payments.dealId, input.deal_id),
        orderBy: [desc(payments.createdAt), desc(payments.id)],
      });

      const normalizedWithMeta = paymentList.map((payment) => {
        const derivedStatus = calculatePaymentStatus({
          paidAt: payment.paidAt,
          expectedDate: payment.expectedDate,
        });

        return {
          ...payment,
          status: derivedStatus as PaymentStatus,
          originalStatus: payment.status,
        };
      });

      const outdatedStatusRows = normalizedWithMeta.filter(
        (payment) => payment.status !== payment.originalStatus,
      );

      if (outdatedStatusRows.length > 0) {
        await Promise.all(
          outdatedStatusRows.map((payment) =>
            ctx.db
              .update(payments)
              .set({
                status: payment.status,
                updatedAt: new Date(),
              })
              .where(eq(payments.id, payment.id)),
          ),
        );
      }

      return normalizedWithMeta.map(({ originalStatus: _originalStatus, ...payment }) => payment);
    }),

  create: protectedProcedure
    .input(createPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deal = await ctx.db.query.deals.findFirst({
          where: and(eq(deals.id, input.deal_id), eq(deals.userId, ctx.user.id)),
          columns: {
            id: true,
          },
        });

        if (!deal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deal not found",
          });
        }

        const [created] = await ctx.db
          .insert(payments)
          .values({
            dealId: input.deal_id,
            amount: input.amount.toString(),
            currency: input.currency,
            kind: input.kind,
            status: calculatePaymentStatus({
              paidAt: input.paid_at ? new Date(input.paid_at) : null,
              expectedDate: input.expected_date ? new Date(input.expected_date) : null,
            }),
            expectedDate: input.expected_date ? new Date(input.expected_date) : null,
            paidAt: input.paid_at ? new Date(input.paid_at) : null,
            paymentMethod: input.payment_method ?? null,
          })
          .returning();

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment",
          });
        }

        return created;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create payment",
          cause: error,
        });
      }
    }),

  markPaid: protectedProcedure
    .input(markPaidInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.payments.findFirst({
          where: eq(payments.id, input.id),
          with: {
            deal: {
              columns: {
                id: true,
                userId: true,
              },
            },
          },
        });

        if (!existing || existing.deal.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment not found",
          });
        }

        const [updated] = await ctx.db
          .update(payments)
          .set({
            status: calculatePaymentStatus({
              paidAt: input.paid_at ? new Date(input.paid_at) : new Date(),
              expectedDate: existing.expectedDate,
            }),
            paidAt: input.paid_at ? new Date(input.paid_at) : new Date(),
            paymentMethod:
              input.payment_method !== undefined
                ? input.payment_method
                : existing.paymentMethod,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, input.id))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment not found",
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not mark payment as paid",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(updatePaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.payments.findFirst({
          where: eq(payments.id, input.id),
          with: {
            deal: {
              columns: {
                id: true,
                userId: true,
              },
            },
          },
        });

        if (!existing || existing.deal.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment not found",
          });
        }

        const updateData: {
          amount?: string;
          currency?: z.infer<typeof paymentCurrencySchema>;
          kind?: z.infer<typeof paymentKindSchema>;
          status?: z.infer<typeof paymentStatusSchema>;
          expectedDate?: Date | null;
          paidAt?: Date | null;
          paymentMethod?: z.infer<typeof paymentMethodSchema> | null;
          updatedAt: Date;
        } = {
          updatedAt: new Date(),
        };

        if (input.amount !== undefined) {
          updateData.amount = input.amount.toString();
        }
        if (input.currency !== undefined) {
          updateData.currency = input.currency;
        }
        if (input.kind !== undefined) {
          updateData.kind = input.kind;
        }
        if (input.expected_date !== undefined) {
          updateData.expectedDate = input.expected_date
            ? new Date(input.expected_date)
            : null;
        }
        if (input.paid_at !== undefined) {
          updateData.paidAt = input.paid_at ? new Date(input.paid_at) : null;
        }
        if (input.payment_method !== undefined) {
          updateData.paymentMethod = input.payment_method;
        }

        const nextPaidAt =
          updateData.paidAt !== undefined ? updateData.paidAt : existing.paidAt;
        const nextExpectedDate =
          updateData.expectedDate !== undefined
            ? updateData.expectedDate
            : existing.expectedDate;

        updateData.status = calculatePaymentStatus({
          paidAt: nextPaidAt,
          expectedDate: nextExpectedDate,
        });

        const [updated] = await ctx.db
          .update(payments)
          .set(updateData)
          .where(eq(payments.id, input.id))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment not found",
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not update payment",
          cause: error,
        });
      }
    }),
});
