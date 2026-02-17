"use client";

import {
  Camera,
  Check,
  CircleEllipsis,
  CreditCard,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { SwipeableDealCard } from "@/src/components/deals/SwipeableDealCard";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/src/components/ui/ContextMenu";
import { QuickActionSheet } from "@/src/components/ui/QuickActionSheet";
import { useLongPress } from "@/src/hooks/useLongPress";

/**
 * Extended deal type to match what might be passed or needed.
 * Ideally we import the RouterOutput type for deals.list, but for now
 * we match SwipeableDealCard's requirements and add what we need.
 */
interface DealType {
  id: string;
  status: string | null;
  title?: string | null;
  totalValue?: string | number | null;
  currency?: "USD" | "INR" | null;
}

interface DealCardWithMenuProps {
  deal: DealType;
  children: React.ReactNode;
  onOpen?: () => void;
  onStatusUpdated?: (dealId: string, status: string) => void;
  activeCardId?: string | null;
  setActiveCardId?: (cardId: string | null) => void;
  className?: string;
  gesturesDisabled?: boolean;
}

export function DealCardWithMenu({
  deal,
  children,
  onOpen,
  onStatusUpdated,
  activeCardId,
  setActiveCardId,
  className,
  gesturesDisabled = false,
}: DealCardWithMenuProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isLifted, setIsLifted] = useState(false);
  const longPressTriggeredRef = useRef(false);

  const trpcUtils = trpc.useUtils();

  const updateStatusMutation = trpc.deals.updateStatus.useMutation({
    onSuccess: async (updated) => {
      onStatusUpdated?.(updated.id, updated.status ?? "");
      await Promise.all([
        trpcUtils.deals.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal status updated");
    },
    onError: (err) => {
      toast.error(`Failed to update status: ${err.message}`);
    },
  });

  const deleteMutation = trpc.deals.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.deals.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal deleted");
    },
    onError: (err) => {
      toast.error(`Failed to delete deal: ${err.message}`);
    },
  });

  const { handlers } = useLongPress({
    threshold: 750,
    disabled: gesturesDisabled,
    onLongPressTriggered: () => {
      longPressTriggeredRef.current = true;
    },
    onLongPress: (e) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "creatorops.onboarding.used_long_press",
          "true",
        );
      }
      // Get the touch point
      const touch = e.touches[0];
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setIsMenuOpen(true);
      setIsLifted(true);
    },
    onCancel: () => {
      setIsLifted(false);
    },
    onFinish: () => {
      // Keep lifted if menu is open, otherwise drop
      if (!isMenuOpen) {
        setIsLifted(false);
      }
    },
  });

  // Wrapper for onOpen to prevent opening when menu interactions occurred
  const handleOpen = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isMenuOpen) return;
    onOpen?.();
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsLifted(false);
  };

  const handleQuickAction = (action: "PAID" | "CANCELLED" | "SNOOZE") => {
    if (action === "SNOOZE") {
      toast.info("Snoozed for 1 day.");
      return;
    }
    updateStatusMutation.mutate({ id: deal.id, status: action });
  };

  const menuActions: ContextMenuAction[] = [
    {
      label: "Quick Actions",
      icon: <CircleEllipsis className="h-5 w-5 text-amber-500" />,
      onClick: () => {
        setIsQuickActionsOpen(true);
      },
      variant: "default",
    },
    {
      label: "Mark as Paid",
      icon: <Check className="h-5 w-5 text-emerald-500" />,
      onClick: () => {
        updateStatusMutation.mutate({ id: deal.id, status: "PAID" });
      },
      variant: "default",
    },
    {
      label: "Add Payment",
      icon: <CreditCard className="h-5 w-5 text-blue-500" />,
      onClick: () => {
        router.push(`/payments/new?dealId=${deal.id}`);
      },
      variant: "default",
    },
    {
      label: "Edit Deal",
      icon: <Edit className="h-5 w-5 text-gray-500" />,
      onClick: () => {
        router.push(`/deals/${deal.id}/edit`);
      },
      variant: "default",
    },
    {
      label: "Mark Posted",
      icon: <Camera className="h-5 w-5 text-purple-500" />,
      onClick: () => {
        toast.info("Open deal details to mark deliverables as posted.");
      },
      variant: "default",
    },
    {
      label: "Delete Deal",
      icon: <Trash2 className="h-5 w-5" />,
      onClick: () => {
        if (confirm("Are you sure you want to delete this deal?")) {
          deleteMutation.mutate({ id: deal.id });
        }
      },
      variant: "destructive",
    },
    {
      label: "Cancel",
      icon: <X className="h-5 w-5" />,
      onClick: () => {
        // Just close
      },
      variant: "cancel",
    },
  ];

  return (
    <>
      <div {...handlers} className="relative touch-manipulation">
        <SwipeableDealCard
          deal={deal}
          onOpen={handleOpen}
          onStatusUpdated={onStatusUpdated}
          activeCardId={activeCardId}
          setActiveCardId={setActiveCardId}
          gestureDisabled={gesturesDisabled || isMenuOpen || isQuickActionsOpen}
          className={cn(
            className,
            "transition-all duration-200",
            isLifted &&
              "scale-[1.02] shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-30",
          )}
        >
          {children}
        </SwipeableDealCard>
      </div>

      <ContextMenu
        isOpen={isMenuOpen}
        position={menuPosition}
        onClose={closeMenu}
        actions={menuActions}
        title={typeof deal.title === "string" ? deal.title : "Deal Options"}
      />

      <QuickActionSheet
        isOpen={isQuickActionsOpen}
        onClose={() => {
          setIsQuickActionsOpen(false);
          setIsLifted(false);
        }}
        dealTitle={typeof deal.title === "string" ? deal.title : "Deal"}
        onAction={handleQuickAction}
      />
    </>
  );
}
