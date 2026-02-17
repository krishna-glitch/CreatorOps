"use client";

import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc/client";

type CommandMenuProps = {
  compact?: boolean;
  className?: string;
};

export function CommandMenu({ compact = false, className }: CommandMenuProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Fetch some data for searching
  const { data: deals } = trpc.deals.list.useQuery(
    { limit: 10 },
    {
      enabled: open,
    },
  );
  const { data: brandsData } = trpc.brands.list.useQuery({ limit: 25 }, {
    enabled: open,
  });
  const brands = brandsData?.items ?? [];

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (isTypingTarget) {
        return;
      }

      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command menu"
        className={cn(
          "relative flex h-10 w-full items-center justify-start rounded-xl pillowy-card-pressed border-none bg-transparent px-3 py-2 text-sm text-muted-foreground shadow-inner transition-all hover:opacity-80",
          compact ? "w-10 justify-center px-0" : "lg:w-96",
          className,
        )}
      >
        <Search
          className={cn("h-4 w-4 shrink-0 opacity-50", !compact && "mr-2")}
        />
        {!compact ? <span>Search deals, brands...</span> : null}
        {!compact ? (
          <kbd className="pointer-events-none absolute right-3 top-2.5 hidden h-5 select-none items-center gap-1 rounded border dash-border dash-bg-panel px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        ) : null}
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList className="h-[450px] overflow-y-auto">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/deals/new"))}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Create New Deal</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/scripts"))}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Open Script Lab</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/payments/new"))}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Add Payment</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {deals && deals.items.length > 0 && (
            <CommandGroup heading="Recent Deals">
              {deals.items.map((deal) => (
                <CommandItem
                  key={deal.id}
                  onSelect={() =>
                    runCommand(() => router.push(`/deals/${deal.id}`))
                  }
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>{deal.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {brands.length > 0 && (
            <CommandGroup heading="Brands">
              {brands.map((brand) => (
                <CommandItem
                  key={brand.id}
                  onSelect={() =>
                    runCommand(() => router.push(`/brands/${brand.id}`))
                  }
                >
                  <Store className="mr-2 h-4 w-4" />
                  <span>{brand.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/dashboard"))}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/calendar"))}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
