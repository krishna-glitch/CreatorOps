"use client";

import { Home, ShoppingCart, BarChart3, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Deals", href: "/deals", icon: ShoppingCart },
  { label: "New", href: "/deals/new", icon: Plus, isFab: true },
  { label: "Stats", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 p-6 z-[var(--z-nav)] pointer-events-none md:hidden">
      <div className="dash-mobile-nav pillowy-card h-16 flex items-center justify-around px-4 border-t shadow-2xl pointer-events-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          if (item.isFab) {
            return (
              <div key={item.label} className="relative -top-8">
                <Link
                  href={item.href}
                  className="w-16 h-16 rounded-full pillowy-card border dash-mobile-fab flex items-center justify-center shadow-2xl transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined icon-3d-gold text-3xl font-bold">
                    <Plus className="h-8 w-8" />
                  </span>
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "w-12 h-10 rounded-xl flex items-center justify-center transition-all",
                isActive ? "nav-3d-active" : ""
              )}
            >
              <span className={cn(
                isActive ? "icon-3d-gold dash-mobile-nav-link-active" : "dash-mobile-nav-link-inactive",
                "flex items-center justify-center"
              )}>
                <Icon className="h-6 w-6" />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
