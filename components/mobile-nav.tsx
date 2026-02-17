"use client";

import { BarChart3, Home, Plus, Settings, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const statsQuery = trpc.analytics.getDashboardStats.useQuery(undefined, {
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const stats = statsQuery.data;
  const hasOverdue = (stats?.overdueItemsCount ?? 0) > 0;
  const hasOutstanding = (stats?.totalOutstandingPayments ?? 0) > 0;

  const navItems: Array<{
    label: string;
    href: string;
    icon: typeof Home;
    badge?: number;
    isFab?: boolean;
  }> = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    {
      label: "Deals",
      href: "/deals",
      icon: ShoppingCart,
      badge: hasOverdue ? stats?.overdueItemsCount : undefined,
    },
    {
      label: hasOutstanding ? "Collect" : "New",
      href: hasOutstanding ? "/payments/new" : "/deals/new",
      icon: Plus,
      isFab: true,
    },
    {
      label: "Stats",
      href: "/analytics",
      icon: BarChart3,
      badge:
        (stats?.activeDealsCount ?? 0) > 0
          ? stats?.activeDealsCount
          : undefined,
    },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 p-6 z-[var(--z-nav)] pointer-events-none md:hidden">
      <div className="dash-mobile-nav pillowy-card h-16 flex items-center justify-around px-4 border-t shadow-2xl pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          if (item.isFab) {
            return (
              <div key={item.label} className="relative -top-8">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className="w-16 h-16 rounded-full pillowy-card border dash-mobile-fab flex items-center justify-center shadow-2xl transition-transform active:scale-95"
                >
                  <Plus className="h-8 w-8 icon-3d-gold" />
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "relative h-12 w-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all",
                isActive ? "nav-3d-active" : "",
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  isActive
                    ? "icon-3d-gold dash-mobile-nav-link-active"
                    : "dash-mobile-nav-link-inactive",
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isActive ? "dash-mobile-nav-link-active" : "dash-text-muted",
                )}
              >
                {item.label}
              </span>
              {(item.badge ?? 0) > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
