import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { eq, sql } from "drizzle-orm";
// Assume user types are created in a place that can be imported, or redefine if needed
// The user created `src/types/calendar.ts` in step 77
import { type CalendarEvent, type CalendarEventType } from "@/types/calendar";
import { redis, CACHE_TTL, isRedisConfigured } from "@/server/infrastructure/cache/redis";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import { payments } from "@/server/infrastructure/database/schema/payments";
import { syncDeliverableReminders } from "@/src/server/domain/services/ReminderSync";

const calendarEventSchema = z.object({
    eventType: z.enum(['deliverable', 'payment', 'reminder']),
    sourceId: z.string(),
    dealId: z.string(),
    currency: z.enum(["USD", "INR"]),
    eventDate: z.date(),
    completedAt: z.date().nullable(),
    title: z.string(),
    status: z.string(),
    relatedAmount: z.number().nullable(),
    color: z.string(),
});

export const calendarRouter = createTRPCRouter({
    getEvents: protectedProcedure
        .input(
            z.object({
                startDate: z.date(),
                endDate: z.date(),
                eventTypes: z.array(z.enum(['deliverable', 'payment', 'reminder'])).optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { startDate, endDate, eventTypes } = input;
            const userId = ctx.user.id;

            // Cache key includes user ID and date range
            // For simplicity, caching based on start/end date strings
            const cacheKey = `calendar:events:${userId}:${startDate.toISOString()}:${endDate.toISOString()}`;

            if (isRedisConfigured) {
                try {
                    const cached = await redis.get(cacheKey);
                    if (cached) {
                        return cached as { events: CalendarEvent[]; totalCount: number };
                    }
                } catch (e) {
                    console.error("Redis cache error", e);
                }
            }

            // Query the view
            // Drizzle ORM doesn't have native view support for `select` typed unless defined as table
            // We can use sql template literal

            const typeFilter = eventTypes && eventTypes.length > 0
                ? sql`AND event_type IN ${eventTypes}`
                : sql``;

            // We need to join with deals to filter by user_id
            // The view definition already joins deals.
            // Wait, standard view selection:
            /*
            SELECT * FROM calendar_events 
            JOIN (deals, auth_users) -- The view already joined deals? Yes:
              JOIN deals ON d.deal_id = deals.id
            So querying "calendar_events" directly doesn't filter by user unless we join users/deals again OR view includes user_id.
            The view definition:
            SELECT ... FROM deliverables d JOIN deals ...
            It DOES NOT include user_id in the select list! 
            
            Wait, in the migration:
            CREATE OR REPLACE VIEW "calendar_events" AS
            SELECT ..., d.deal_id ...
            
            It has `deal_id`. I can join `deals` on `calendar_events.deal_id = deals.id` to filter by `deals.user_id`.
            */

            // Use ISO strings for dates to avoid serialization issues
            const startStr = startDate.toISOString();
            const endStr = endDate.toISOString();

            const events = await ctx.db.execute(sql`
        SELECT 
            ce.event_type as "eventType",
            ce.source_id as "sourceId",
            ce.deal_id as "dealId",
            d.currency as "currency",
            ce.event_date as "eventDate",
            ce.completed_at as "completedAt",
            ce.title,
            ce.status,
            ce.related_amount as "relatedAmount",
            ce.color
        FROM calendar_events ce
        JOIN deals d ON ce.deal_id = d.id
        WHERE d.user_id = ${userId}
        AND ce.event_date >= ${startStr}::timestamp
        AND ce.event_date <= ${endStr}::timestamp
        ${typeFilter}
        ORDER BY ce.event_date ASC
        LIMIT 500
      `);

            // Transform raw rows to typed objects (Drizzle execute returns roughly `Record<string, unknown>[]`)
            const typedEvents: CalendarEvent[] = events.map((row: any) => ({
                eventType: row.eventType as CalendarEventType, // Explicit cast needed
                sourceId: row.sourceId,
                dealId: row.dealId,
                currency: row.currency === "INR" ? "INR" : "USD",
                eventDate: new Date(row.eventDate),
                completedAt: row.completedAt ? new Date(row.completedAt) : null,
                title: row.title,
                status: row.status,
                relatedAmount: row.relatedAmount ? Number(row.relatedAmount) : null,
                color: row.color,
            }));

            const result = {
                events: typedEvents,
                totalCount: typedEvents.length,
            };

            if (isRedisConfigured) {
                try {
                    await redis.set(cacheKey, result, { ex: CACHE_TTL.SHORT });
                } catch (e) {
                    console.error("Redis set error", e);
                }
            }

            return result;
        }),

    // ... existing queries ...
    getEventById: protectedProcedure
        .input(z.object({ sourceId: z.string(), eventType: z.enum(['deliverable', 'payment', 'reminder']) }))
        .query(async ({ ctx, input }) => {
            // ... existing implementation ...
            const events = await ctx.db.execute(sql`
        SELECT 
            ce.event_type as "eventType",
            ce.source_id as "sourceId",
            ce.deal_id as "dealId",
            ce.event_date as "eventDate",
            ce.completed_at as "completedAt",
            ce.title,
            ce.status,
            ce.related_amount as "relatedAmount",
            ce.color,
            d.title as "dealTitle",
            b.name as "brandName"
        FROM calendar_events ce
        JOIN deals d ON ce.deal_id = d.id
        JOIN brands b ON d.brand_id = b.id
        WHERE ce.source_id = ${input.sourceId}
        AND ce.event_type = ${input.eventType}
        AND d.user_id = ${ctx.user.id}
       `);

            return events[0] || null;
        }),

    updateEventDate: protectedProcedure
        .input(z.object({
            sourceId: z.string(),
            eventType: z.enum(['deliverable', 'payment']),
            newDate: z.date(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { sourceId, eventType, newDate } = input;
            const userId = ctx.user.id;
            const now = new Date();

            if (newDate < now) {
                throw new Error("Cannot reschedule events into the past");
            }

            // Invalidate cache
            // Since we don't know the exact old date here easily without querying, 
            // and keys are range-based, it's hard to granularly invalidate.
            // For now, we might accept that cache is stale for 5 mins or implement a broader invalidation strategy.
            // Or we could iterate keys? No, too expensive. 
            // Better: The user will optimize this later. For now, rely on TTL or we could try to clear specific keys if we knew them.

            if (eventType === 'deliverable') {
                // Update deliverable
                // Verify ownership logic is implicit if we filter by deal ownership in the update
                // But simpler to just check if it exists and belongs to user first or use a where clause that includes user check via join?
                // Drizzle update with join is not standard/easy.
                // Standard pattern: Find first, then update.

                const existing = await ctx.db.query.deliverables.findFirst({
                    where: eq(deliverables.id, sourceId),
                    with: { deal: true }
                });

                if (!existing || existing.deal.userId !== userId) {
                    throw new Error("Event not found or unauthorized");
                }

                // Block if already posted?
                if (existing.status === 'POSTED') {
                    throw new Error("Cannot reschedule a posted deliverable");
                }

                await ctx.db.update(deliverables)
                    .set({ scheduledAt: newDate, updatedAt: new Date() })
                    .where(eq(deliverables.id, sourceId));

                await syncDeliverableReminders({
                    db: ctx.db as any,
                    deliverable: {
                        id: existing.id,
                        dealId: existing.dealId,
                        scheduledAt: newDate,
                        postedAt: existing.postedAt,
                        status: existing.status,
                    },
                    now,
                });

            } else if (eventType === 'payment') {
                const existing = await ctx.db.query.payments.findFirst({
                    where: eq(payments.id, sourceId),
                    with: { deal: true }
                });

                if (!existing || existing.deal.userId !== userId) {
                    throw new Error("Event not found or unauthorized");
                }

                if (existing.status === 'PAID') {
                    throw new Error("Cannot reschedule a paid payment");
                }

                await ctx.db.update(payments)
                    .set({ expectedDate: newDate, updatedAt: new Date() })
                    .where(eq(payments.id, sourceId));
            }

            return { success: true };
        }),
});
