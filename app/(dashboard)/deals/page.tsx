import { redirect } from "next/navigation";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { appRouter } from "@/server/api/root";
import { DealsListClient } from "./deals-list-client";

const PAGE_SIZE = 20;

export default async function DealsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const caller = appRouter.createCaller({
    db,
    user,
    headers: new Headers(),
  });

  let initialData: Awaited<ReturnType<typeof caller.deals.list>> | null = null;
  let aiExtractionEnabled = true;

  try {
    initialData = await caller.deals.list({ limit: PAGE_SIZE });
  } catch (error) {
    console.error("Failed to prefetch deals list", error);
  }

  try {
    const availability = await caller.ai.extractionAvailability();
    aiExtractionEnabled = availability.enabled;
  } catch (error) {
    console.error("Failed to prefetch AI extraction availability", error);
  }

  return (
    <DealsListClient
      initialData={initialData}
      pageSize={PAGE_SIZE}
      aiExtractionEnabled={aiExtractionEnabled}
    />
  );
}
