import { redirect } from "next/navigation";
import { db } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { appRouter } from "@/server/api/root";
import { SettingsClient } from "@/components/settings-client";

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
  
  return (
    <div className="mx-auto w-full max-w-2xl px-2 py-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight dash-title">Settings</h1>
        <p className="text-muted-foreground dash-text-muted">
          Manage your account, appearance, and app preferences.
        </p>
      </div>

      <SettingsClient 
        user={{ email: user.email }}
        storageUsage={{
          usedMb: formatBytesToMb(usage.totalBytesUsed),
          limitGb: usage.storageLimitBytes / (1024 * 1024 * 1024),
          percentUsed: usage.percentUsed,
          approachingLimit: usage.approachingLimit
        }}
      />
    </div>
  );
}

