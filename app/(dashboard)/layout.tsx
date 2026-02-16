import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { MobileNav } from "@/components/mobile-nav";
import { MobileHeader } from "@/components/mobile-header";
import { NotificationPopover } from "@/components/notification-popover";
import { NotificationPrompt } from "@/src/components/notifications/NotificationPrompt";

import { NotificationMessageHandler } from "@/src/components/notifications/NotificationMessageHandler";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="dashboard-shell flex min-h-screen w-full flex-col md:flex-row bg-background transition-colors duration-300">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col relative">
        <MobileHeader userEmail={user.email} />

        <header className="dash-shell-header hidden h-20 items-center justify-between border-b px-8 md:flex">
          <div className="flex items-center">
            <h1 className="font-serif text-2xl font-bold gold-text leading-tight">CreatorOps</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block w-96">
              <div className="relative">
                <Search className="dash-shell-search-icon absolute left-3 top-3 h-4 w-4" />
                <Input
                  placeholder="Search deals, brands..."
                  className="pl-10 h-10 pillowy-card-pressed border-none bg-transparent shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full pillowy-card flex items-center justify-center">
                <NotificationPopover />
              </div>
              <div className="dash-shell-avatar-ring w-10 h-10 rounded-full border p-0.5 shadow-lg overflow-hidden">
                <div className="dash-shell-avatar-inner w-full h-full rounded-full flex items-center justify-center">
                  <span className="dash-shell-avatar-text text-xs font-bold">
                    {user.email?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-32 md:pb-8 lg:p-8">
          {children}
        </main>

        <MobileNav />
        <NotificationPrompt />
        <NotificationMessageHandler />
      </div>
    </div>
  );
}
