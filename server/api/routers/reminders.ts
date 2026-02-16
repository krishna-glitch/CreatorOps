import { TRPCError } from "@trpc/server";
import { addDays } from "date-fns";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { reminders } from "@/server/infrastructure/database/schema/reminders";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const reminderIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const remindersRouter = createTRPCRouter({
  listOpen: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: reminders.id,
        dealId: reminders.dealId,
        deliverableId: reminders.deliverableId,
        reason: reminders.reason,
        dueAt: reminders.dueAt,
        priority: reminders.priority,
        status: reminders.status,
        deliveryStatus: reminders.deliveryStatus,
        dedupeKey: reminders.dedupeKey,
        createdAt: reminders.createdAt,
        updatedAt: reminders.updatedAt,
        dealTitle: deals.title,
      })
      .from(reminders)
      .innerJoin(deals, eq(reminders.dealId, deals.id))
      .where(and(eq(deals.userId, ctx.user.id), eq(reminders.status, "OPEN")))
      .orderBy(
        sql`
          case ${reminders.priority}
            when 'CRITICAL' then 1
            when 'HIGH' then 2
            when 'MED' then 3
            when 'LOW' then 4
            else 5
          end
        `,
        asc(reminders.dueAt),
      );

    return rows;
  }),

  markDone: protectedProcedure
    .input(reminderIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.reminders.findFirst({
        where: eq(reminders.id, input.id),
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
          message: "Reminder not found",
        });
      }

      const [updated] = await ctx.db
        .update(reminders)
        .set({
          status: "DONE",
          updatedAt: new Date(),
        })
        .where(eq(reminders.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      return updated;
    }),

  snooze: protectedProcedure
    .input(reminderIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.reminders.findFirst({
        where: eq(reminders.id, input.id),
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
          message: "Reminder not found",
        });
      }

      const [updated] = await ctx.db
        .update(reminders)
        .set({
          dueAt: addDays(existing.dueAt, 1),
          status: "OPEN",
          deliveryStatus: "PENDING",
          updatedAt: new Date(),
        })
        .where(eq(reminders.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      return updated;
    }),

  markPosted: protectedProcedure
    .input(reminderIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.reminders.findFirst({
        where: eq(reminders.id, input.id),
        with: {
          deal: {
            columns: {
              userId: true,
            },
          },
        },
      });

      if (!existing || existing.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      if (!existing.deliverableId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reminder is not linked to a deliverable",
        });
      }

      const deliverable = await ctx.db.query.deliverables.findFirst({
        where: eq(deliverables.id, existing.deliverableId),
        with: {
          deal: {
            columns: {
              userId: true,
            },
          },
        },
      });

      if (!deliverable || deliverable.deal.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deliverable not found",
        });
      }

      const now = new Date();

      await ctx.db
        .update(deliverables)
        .set({
          postedAt: deliverable.postedAt ?? now,
          status: "POSTED",
          updatedAt: now,
        })
        .where(eq(deliverables.id, deliverable.id));

      await ctx.db
        .update(reminders)
        .set({
          status: "DONE",
          updatedAt: now,
        })
        .where(
          and(
            eq(reminders.deliverableId, deliverable.id),
            inArray(reminders.status, ["OPEN", "SNOOZED"]),
          ),
        );

      return {
        ok: true,
        deliverableId: deliverable.id,
      };
    }),
});
