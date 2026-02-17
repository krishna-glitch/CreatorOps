"use client";

import { Menu, Package2, Bell, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { Input } from "@/components/ui/input";
import { NotificationPopover } from "@/components/notification-popover";

export function MobileHeader({ userEmail }: { userEmail?: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const isSearching = searchParams.get("search") === "true";
  const searchQuery = searchParams.get("q") || "";

  const toggleSearch = (active: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.set("search", "true");
    } else {
      params.delete("search");
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (isSearching) {
    return (
      <header className="dash-mobile-header sticky top-0 z-[var(--z-header)] flex h-14 items-center gap-2 border-b px-2 md:hidden">
        <div className="relative flex-1">
          <Search className="dash-mobile-icon absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            autoFocus
            type="search"
            placeholder="Search deals, brands..."
            className="w-full pl-8"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Button variant="ghost" className="dash-shell-text-btn" onClick={() => toggleSearch(false)}>Cancel</Button>
      </header>
    );
  }

  return (
    <header className="dash-mobile-header sticky top-0 z-[var(--z-header)] flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="dash-shell-icon-btn" >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="dash-mobile-drawer fixed inset-y-0 left-0 h-full w-[280px] translate-x-0 translate-y-0 rounded-none border-r p-0 duration-300 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left z-[var(--z-sheet)]">
          <DialogHeader className="dash-mobile-drawer-header border-b p-4">
            <DialogTitle className="flex items-center gap-2">
              <Package2 className="dash-mobile-brand-icon h-6 w-6" />
              <span className="gold-text">CreatorOps</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
             <div className="flex h-full flex-col p-2">
                <nav className="grid gap-1 px-2 py-4">
                  <Link href="/dashboard" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Home</Link>
                  <Link href="/deals" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Deals</Link>
                  <Link href="/brands" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Brands</Link>
                  <Link href="/conflicts" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Conflicts</Link>
                  <Link href="/analytics" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Analytics</Link>
                  <Link href="/calendar" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Calendar</Link>
                  <Link href="/scripts" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Script Lab</Link>
                  <Link href="/settings" className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium">Settings</Link>
                </nav>
                <div className="mt-auto border-t p-4">
                   <div className="dash-shell-email mb-4 text-xs">{userEmail}</div>
                   <LogoutButton />
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Link href="/dashboard" className="flex flex-1 items-center justify-center gap-2 font-semibold">
        <Package2 className="dash-mobile-brand-icon h-6 w-6" />
        <span className="gold-text text-lg tracking-tight">CreatorOps</span>
      </Link>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="dash-shell-icon-btn"  onClick={() => toggleSearch(true)}>
          <Search className="dash-mobile-icon h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
