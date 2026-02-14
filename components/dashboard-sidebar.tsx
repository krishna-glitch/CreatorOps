"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Home,
  Package2,
  Plus,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const conflictsSummaryQuery = trpc.conflicts.summary.useQuery(undefined, {
    staleTime: 30_000,
  });
  const activeConflictCount = conflictsSummaryQuery.data?.activeCount ?? 0;

  return (
    <div className="hidden border-r bg-gray-100/40 md:block dark:bg-gray-800/40">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package2 className="h-6 w-6" />
            <span className="">CreatorOps</span>
          </Link>
          <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </div>
        <div className="flex-1">
          <div className="px-2 py-2 lg:px-4">
            <Link
              href="/deals/new"
              className={cn(buttonVariants(), "w-full")}
              onClick={() => router.push("/deals/new")}
            >
              <Plus className="h-4 w-4" />
              New Deal
            </Link>
          </div>
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/dashboard")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/deals"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/deals")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              Deals
            </Link>
            <Link
              href="/brands"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/brands")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <Store className="h-4 w-4" />
              Brands
            </Link>
            <Link
              href="/conflicts"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/conflicts")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Conflicts</span>
              <Badge
                variant="outline"
                className={cn(
                  "ml-auto",
                  activeConflictCount > 0
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : "",
                )}
              >
                {activeConflictCount}
              </Badge>
            </Link>
            <Link
              href="/analytics"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/analytics")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActiveRoute(pathname, "/settings")
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
