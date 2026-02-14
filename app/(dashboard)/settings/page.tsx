import { redirect } from "next/navigation";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { appRouter } from "@/server/api/root";

function formatBytesToMb(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export default async function SettingsPage() {
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

  const usage = await caller.mediaAssets.storageUsage();
  const usedMb = formatBytesToMb(usage.totalBytesUsed);
  const limitGb = usage.storageLimitBytes / (1024 * 1024 * 1024);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Storage quota usage for media assets.
        </p>

        <div className="mt-5 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-sm font-medium">
            Storage used: {usedMb} MB / {limitGb} GB ({usage.percentUsed}%)
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className={`h-full transition-all ${
                usage.approachingLimit ? "bg-yellow-500" : "bg-blue-600"
              }`}
              style={{ width: `${usage.percentUsed}%` }}
            />
          </div>

          {usage.approachingLimit ? (
            <p className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-900/20 dark:text-yellow-200">
              Warning: You are above 80% of your 1GB storage quota.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

