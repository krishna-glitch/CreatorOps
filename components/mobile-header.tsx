"use client";

import { Menu, Package2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { LogoutButton } from "@/components/logout-button";
import { NotificationPopover } from "@/components/notification-popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileHeader({ userEmail }: { userEmail?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="dash-mobile-header sticky top-0 z-[var(--z-header)] flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="dash-shell-icon-btn">
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
          <div className="flex-1 overflow-y-auto">
            <div className="flex h-full flex-col p-2">
              <nav className="grid gap-1 px-2 py-4">
                <Link
                  href="/dashboard"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Home
                </Link>
                <Link
                  href="/deals"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Deals
                </Link>
                <Link
                  href="/brands"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Brands
                </Link>
                <Link
                  href="/conflicts"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Conflicts
                </Link>
                <Link
                  href="/analytics"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Analytics
                </Link>
                <Link
                  href="/calendar"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Calendar
                </Link>
                <Link
                  href="/scripts"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Script Lab
                </Link>
                <Link
                  href="/settings"
                  className="dash-mobile-drawer-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Settings
                </Link>
              </nav>
              <div className="mt-auto border-t p-4">
                <div className="dash-shell-email mb-4 text-xs">{userEmail}</div>
                <LogoutButton />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Link
        href="/dashboard"
        className="flex flex-1 items-center justify-center gap-2 font-semibold"
      >
        <Package2 className="dash-mobile-brand-icon h-6 w-6" />
        <span className="gold-text text-lg tracking-tight">CreatorOps</span>
      </Link>

      <div className="flex items-center gap-1">
        <CommandMenu compact className="dash-shell-icon-btn h-9 w-9" />
        <NotificationPopover />
      </div>
    </header>
  );
}
