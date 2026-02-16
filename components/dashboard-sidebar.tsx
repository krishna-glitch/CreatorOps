"use client";

import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  Package2,
  Plus,
  Settings,
  ShoppingCart,
  Store,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "creatorops.sidebar.collapsed.v1";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const conflictsSummaryQuery = trpc.conflicts.summary.useQuery(undefined, {
    staleTime: 30_000,
  });
  const activeConflictCount = conflictsSummaryQuery.data?.activeCount ?? 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted =
      window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    setCollapsed(persisted);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div
      className={cn(
        "dash-sidebar hidden border-r transition-[width] duration-200 md:block",
        collapsed ? "w-[76px]" : "w-[280px]",
      )}
    >
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="dash-sidebar-header flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link
            href="/"
            className={cn(
              "dash-sidebar-brand flex items-center gap-2 font-semibold",
              collapsed && "justify-center",
            )}
          >
            <Package2 className="h-6 w-6" />
            {!collapsed ? <span>CreatorOps</span> : null}
          </Link>
          <Button
            variant="outline"
            size="icon"
            className="dash-shell-icon-btn ml-auto h-8 w-8"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex-1">
          <div className={cn("px-2 py-2", !collapsed && "lg:px-4")}>
            <Link
              href="/deals/new"
              className={cn(
                buttonVariants(),
                "dash-shell-primary-btn w-full",
                collapsed && "justify-center px-0",
              )}
              onClick={() => router.push("/deals/new")}
              title="New Deal"
            >
              <Plus className="h-4 w-4" />
              {!collapsed ? "New Deal" : null}
            </Link>
          </div>
          <nav
            className={cn(
              "grid items-start px-2 text-sm font-medium",
              !collapsed && "lg:px-4",
            )}
          >
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/dashboard")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Dashboard"
            >
              <Home className="h-4 w-4" />
              {!collapsed ? "Dashboard" : null}
            </Link>
            <Link
              href="/deals"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/deals")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Deals"
            >
              <ShoppingCart className="h-4 w-4" />
              {!collapsed ? "Deals" : null}
            </Link>
            <Link
              href="/brands"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/brands")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Brands"
            >
              <Store className="h-4 w-4" />
              {!collapsed ? "Brands" : null}
            </Link>
            <Link
              href="/conflicts"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/conflicts")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Conflicts"
            >
              <AlertTriangle className="h-4 w-4" />
              {!collapsed ? <span>Conflicts</span> : null}
              <Badge
                variant="outline"
                className={cn(
                  collapsed ? "ml-0" : "ml-auto",
                  activeConflictCount > 0 ? "dash-sidebar-conflict-badge" : "",
                )}
              >
                {activeConflictCount}
              </Badge>
            </Link>
            <Link
              href="/analytics"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/analytics")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Analytics"
            >
              <BarChart3 className="h-4 w-4" />
              {!collapsed ? "Analytics" : null}
            </Link>
            <Link
              href="/scripts"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/scripts")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Script Lab"
            >
              <Wand2 className="h-4 w-4" />
              {!collapsed ? "Script Lab" : null}
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-shell-text-muted",
                collapsed && "justify-center px-2",
                isActiveRoute(pathname, "/settings")
                  ? "dash-sidebar-link-active text-shell-text"
                  : "dash-sidebar-link",
              )}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
              {!collapsed ? "Settings" : null}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
