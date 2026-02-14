import { and, eq, gte, inArray, lt, or } from "drizzle-orm";
import JSZip from "jszip";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { brands } from "@/server/infrastructure/database/schema/brands";
import { deals } from "@/server/infrastructure/database/schema/deals";
import { deliverables } from "@/server/infrastructure/database/schema/deliverables";
import {
  conflicts,
  exclusivityRules,
} from "@/server/infrastructure/database/schema/exclusivity";
import { feedbackItems } from "@/server/infrastructure/database/schema/feedback";
import { payments } from "@/server/infrastructure/database/schema/payments";
import { reminders } from "@/server/infrastructure/database/schema/reminders";
import { reworkCycles } from "@/server/infrastructure/database/schema/reworkCycles";

export const runtime = "nodejs";

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIso(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key);
      }
      return set;
    }, new Set<string>()),
  );

  const escapeCsvValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "";
    }

    const raw =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

    if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
      return `"${raw.replaceAll('"', '""')}"`;
    }

    return raw;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ];

  return lines.join("\n");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const startDateRaw = url.searchParams.get("start_date");
  const endDateRaw = url.searchParams.get("end_date");
  const anonymize = url.searchParams.get("anonymize") === "true";

  const startDate = parseDateParam(startDateRaw);
  const endDateParsed = parseDateParam(endDateRaw);

  if ((startDateRaw && !startDate) || (endDateRaw && !endDateParsed)) {
    return new Response(
      JSON.stringify({ error: "Invalid start_date or end_date query param" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const endDateExclusive = (() => {
    if (!endDateParsed || !endDateRaw) {
      return null;
    }

    if (isDateOnly(endDateRaw)) {
      const shifted = new Date(endDateParsed);
      shifted.setDate(shifted.getDate() + 1);
      return shifted;
    }

    return endDateParsed;
  })();

  if (startDate && endDateExclusive && startDate >= endDateExclusive) {
    return new Response(
      JSON.stringify({ error: "start_date must be earlier than end_date" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const dateFilters = {
    deals:
      startDate || endDateExclusive
        ? and(
            startDate ? gte(deals.createdAt, startDate) : undefined,
            endDateExclusive
              ? lt(deals.createdAt, endDateExclusive)
              : undefined,
          )
        : undefined,
    brands:
      startDate || endDateExclusive
        ? and(
            startDate ? gte(brands.createdAt, startDate) : undefined,
            endDateExclusive
              ? lt(brands.createdAt, endDateExclusive)
              : undefined,
          )
        : undefined,
  };

  const userBrands = await db.query.brands.findMany({
    where: and(eq(brands.userId, user.id), dateFilters.brands),
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
  });

  const userDeals = await db.query.deals.findMany({
    where: and(eq(deals.userId, user.id), dateFilters.deals),
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
  });

  const dealIds = userDeals.map((deal) => deal.id);
  const deliverableRows =
    dealIds.length > 0
      ? await db.query.deliverables.findMany({
          where: inArray(deliverables.dealId, dealIds),
          orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
        })
      : [];

  const deliverableIds = deliverableRows.map((deliverable) => deliverable.id);

  const [paymentRows, feedbackRows, reminderRows, exclusivityRuleRows] =
    dealIds.length > 0
      ? await Promise.all([
          db.query.payments.findMany({
            where: inArray(payments.dealId, dealIds),
            orderBy: (table, { desc }) => [
              desc(table.createdAt),
              desc(table.id),
            ],
          }),
          db.query.feedbackItems.findMany({
            where: inArray(feedbackItems.dealId, dealIds),
            orderBy: (table, { desc }) => [
              desc(table.createdAt),
              desc(table.id),
            ],
          }),
          db.query.reminders.findMany({
            where: inArray(reminders.dealId, dealIds),
            orderBy: (table, { desc }) => [
              desc(table.createdAt),
              desc(table.id),
            ],
          }),
          db.query.exclusivityRules.findMany({
            where: inArray(exclusivityRules.dealId, dealIds),
          }),
        ])
      : [[], [], [], []];

  const reworkCycleRows =
    deliverableIds.length > 0
      ? await db.query.reworkCycles.findMany({
          where: inArray(reworkCycles.deliverableId, deliverableIds),
          orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
        })
      : [];

  const conflictRows =
    dealIds.length + deliverableIds.length > 0 || exclusivityRuleRows.length > 0
      ? await db.query.conflicts.findMany({
          where: or(
            dealIds.length + deliverableIds.length > 0
              ? inArray(conflicts.newDealOrDeliverableId, [
                  ...dealIds,
                  ...deliverableIds,
                ])
              : undefined,
            exclusivityRuleRows.length > 0
              ? inArray(
                  conflicts.conflictingRuleId,
                  exclusivityRuleRows.map((rule) => rule.id),
                )
              : undefined,
          ),
        })
      : [];

  const brandAliasMap = new Map<string, string>();
  const orderedBrands = [...userBrands].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const [index, brand] of orderedBrands.entries()) {
    brandAliasMap.set(brand.id, `Brand ${index + 1}`);
  }

  const displayBrandName = (brandId: string) => {
    const brand = userBrands.find((row) => row.id === brandId);
    if (!brand) {
      return "Unknown Brand";
    }
    return anonymize ? (brandAliasMap.get(brandId) ?? "Brand") : brand.name;
  };

  const dealById = new Map(userDeals.map((deal) => [deal.id, deal]));

  const dealsCsvRows = userDeals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    brand_id: deal.brandId,
    brand_name: displayBrandName(deal.brandId),
    status: deal.status,
    total_value: deal.totalValue,
    currency: deal.currency,
    revision_limit: deal.revisionLimit,
    revisions_used: deal.revisionsUsed,
    created_at: toIso(deal.createdAt),
    updated_at: toIso(deal.updatedAt),
  }));

  const paymentsCsvRows = paymentRows.map((payment) => {
    const deal = dealById.get(payment.dealId);
    return {
      id: payment.id,
      deal_id: payment.dealId,
      deal_title: deal?.title ?? "Unknown Deal",
      brand_name: deal ? displayBrandName(deal.brandId) : "Unknown Brand",
      amount: payment.amount,
      currency: payment.currency,
      kind: payment.kind,
      status: payment.status,
      expected_date: toIso(payment.expectedDate),
      paid_at: toIso(payment.paidAt),
      payment_method: payment.paymentMethod,
      created_at: toIso(payment.createdAt),
      updated_at: toIso(payment.updatedAt),
    };
  });

  const deliverablesCsvRows = deliverableRows.map((deliverable) => {
    const deal = dealById.get(deliverable.dealId);
    return {
      id: deliverable.id,
      deal_id: deliverable.dealId,
      deal_title: deal?.title ?? "Unknown Deal",
      brand_name: deal ? displayBrandName(deal.brandId) : "Unknown Brand",
      platform: deliverable.platform,
      type: deliverable.type,
      quantity: deliverable.quantity,
      status: deliverable.status,
      scheduled_at: toIso(deliverable.scheduledAt),
      posted_at: toIso(deliverable.postedAt),
      created_at: toIso(deliverable.createdAt),
      updated_at: toIso(deliverable.updatedAt),
    };
  });

  const jsonPayload = {
    metadata: {
      user_id: user.id,
      exported_at: new Date().toISOString(),
      anonymized: anonymize,
      date_range: {
        start_date: startDate?.toISOString() ?? null,
        end_date: endDateExclusive?.toISOString() ?? null,
      },
      counts: {
        brands: userBrands.length,
        deals: userDeals.length,
        deliverables: deliverableRows.length,
        payments: paymentRows.length,
        feedback_items: feedbackRows.length,
        rework_cycles: reworkCycleRows.length,
        reminders: reminderRows.length,
        exclusivity_rules: exclusivityRuleRows.length,
        conflicts: conflictRows.length,
      },
    },
    data: {
      brands: userBrands.map((brand) => ({
        ...brand,
        name: anonymize ? (brandAliasMap.get(brand.id) ?? "Brand") : brand.name,
      })),
      deals: userDeals,
      deliverables: deliverableRows,
      payments: paymentRows,
      feedback_items: feedbackRows,
      rework_cycles: reworkCycleRows,
      reminders: reminderRows,
      exclusivity_rules: exclusivityRuleRows,
      conflicts: conflictRows,
    },
  };

  const zip = new JSZip();
  zip.file("deals.csv", toCsv(dealsCsvRows));
  zip.file("payments.csv", toCsv(paymentsCsvRows));
  zip.file("deliverables.csv", toCsv(deliverablesCsvRows));
  zip.file("data.json", JSON.stringify(jsonPayload, null, 2));

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const fileSuffix = anonymize ? "anonymized" : "full";
  const filename = `creatorops_export_${fileSuffix}_${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
