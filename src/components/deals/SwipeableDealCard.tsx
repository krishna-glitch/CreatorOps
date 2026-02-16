"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useSwipeGesture } from "@/src/hooks/useSwipeGesture";
import { triggerHaptic } from "@/src/lib/utils/haptics";

type SwipeStatus = "PAID" | "CANCELLED";
type SwipeDirection = "right" | "left" | null;
type DealStatusForUndo =
  | "INBOUND"
  | "NEGOTIATING"
  | "AGREED"
  | "PAID"
  | "CANCELLED";

type SwipeableDealCardProps = {
  deal: {
    id: string;
    status: string | null;
    title?: string | null;
  };
  children: ReactNode;
  onOpen?: () => void;
  onStatusUpdated?: (dealId: string, status: SwipeStatus) => void;
  activeCardId?: string | null;
  setActiveCardId?: (cardId: string | null) => void;
  className?: string;
  gestureDisabled?: boolean;
};

function getSwipeMutationError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Could not update deal status.";
}

function isDealStatusForUndo(value: string | null): value is DealStatusForUndo {
  return (
    value === "INBOUND" ||
    value === "NEGOTIATING" ||
    value === "AGREED" ||
    value === "PAID" ||
    value === "CANCELLED"
  );
}

export function SwipeableDealCard({
  deal,
  children,
  onOpen,
  onStatusUpdated,
  activeCardId,
  setActiveCardId,
  className,
  gestureDisabled = false,
}: SwipeableDealCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [announceText, setAnnounceText] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionDirection, setCompletionDirection] =
    useState<SwipeDirection>(null);
  const [snapBack, setSnapBack] = useState(false);

  const trpcUtils = trpc.useUtils();
  const updateStatusMutation = trpc.deals.updateStatus.useMutation({
    onSuccess: async (updated) => {
      onStatusUpdated?.(updated.id, updated.status as SwipeStatus);
      await Promise.all([
        trpcUtils.deals.getById.invalidate({ id: updated.id }),
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
    },
  });

  const canSwipeRight = deal.status !== "PAID";
  const canSwipeLeft = deal.status !== "PAID" && deal.status !== "CANCELLED";
  const swipeDisabled = !canSwipeLeft && !canSwipeRight;
  const isSwipeBlocked =
    gestureDisabled || isCompleting || updateStatusMutation.isPending;

  const completeAction = useCallback(
    async (status: SwipeStatus) => {
      if (updateStatusMutation.isPending) {
        return;
      }

      const previousStatus = deal.status;
      const direction = status === "PAID" ? "right" : "left";
      setCompletionDirection(direction);
      setIsCompleting(true);
      
      const successMessage = status === "PAID" ? "Deal marked as paid." : "Deal marked as cancelled.";
      setAnnounceText(successMessage);

      triggerHaptic(200, [50, 50, 50, 50, 50]);

      try {
        await updateStatusMutation.mutateAsync({ id: deal.id, status });
        
        // Show Undo Toast
        toast.success(successMessage, {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                if (!isDealStatusForUndo(previousStatus)) {
                  toast.info("Nothing to undo.");
                  return;
                }
                await updateStatusMutation.mutateAsync({
                  id: deal.id,
                  status: previousStatus,
                });
                toast.info("Action reverted.");
              } catch (e) {
                toast.error("Failed to undo.");
              }
            },
          },
        });
      } catch (error) {
        toast.error(getSwipeMutationError(error), { duration: 3000 });
      } finally {
        window.setTimeout(() => {
          setIsCompleting(false);
          setCompletionDirection(null);
          resetGesture();
        }, 220);
      }
    },
    [deal.id, deal.status, onStatusUpdated, updateStatusMutation],
  );

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    deltaX,
    swipeProgress,
    swipeDirection,
    previewAction,
    isExecuteThresholdReached,
    isDragging,
    hasMoved,
    resetGesture,
  } = useSwipeGesture({
    cardRef,
    disabled: isSwipeBlocked,
    canSwipeLeft,
    canSwipeRight,
    onRequestLock: () => {
      if (swipeDisabled) {
        // Provide subtle feedback that swiping is disabled
        triggerHaptic(30, [10]);
        toast.info(`Deal is already ${deal.status?.toLowerCase()}.`, { duration: 1500 });
        return false;
      }
      if (activeCardId && activeCardId !== deal.id) {
        return false;
      }
      setActiveCardId?.(deal.id);
      return true;
    },
    onReleaseLock: () => {
      setActiveCardId?.(null);
    },
    onRelease: ({ executed }) => {
      if (!executed) {
        setSnapBack(true);
        window.setTimeout(() => setSnapBack(false), 300);
      }
    },
    onSwipeRight: () => {
      void completeAction("PAID");
    },
    onSwipeLeft: () => {
      void completeAction("CANCELLED");
    },
  });

  const cardWidth = cardRef.current?.getBoundingClientRect().width ?? 320;
  const completionOffset =
    completionDirection === "right"
      ? cardWidth + 72
      : completionDirection === "left"
        ? -cardWidth - 72
        : 0;
  const translateX = isCompleting ? completionOffset : deltaX;

  const backgroundOpacity = Math.min(1, swipeProgress / 0.6);
  // Smooth icon scaling from 0 to 1 based on progress
  const iconScale = Math.min(1, swipeProgress / 0.4);
  
  const actionLabel =
    previewAction === "PAID"
      ? "Mark as Paid"
      : previewAction === "CANCELLED"
        ? "Cancel Deal"
        : "";
  const isRight = swipeDirection === "right";
  const isLeft = swipeDirection === "left";

  const transition = useMemo(() => {
    if (isDragging) {
      return "none";
    }
    if (isCompleting) {
      return "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";
    }
    if (snapBack) {
      return "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)";
    }
    return "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
  }, [isCompleting, isDragging, snapBack]);

  const onClick = useCallback(() => {
    if (hasMoved || isDragging || isCompleting || gestureDisabled) {
      return;
    }
    onOpen?.();
  }, [gestureDisabled, hasMoved, isCompleting, isDragging, onOpen]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (gestureDisabled) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen?.();
        return;
      }

      if (event.key === "ArrowRight" && canSwipeRight) {
        event.preventDefault();
        void completeAction("PAID");
        return;
      }

      if (event.key === "ArrowLeft" && canSwipeLeft) {
        event.preventDefault();
        void completeAction("CANCELLED");
      }
    },
    [canSwipeLeft, canSwipeRight, completeAction, gestureDisabled, onOpen],
  );

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-between px-5 text-white",
          isRight && "bg-gradient-to-r from-emerald-700 to-emerald-500",
          isLeft && "bg-gradient-to-l from-red-700 to-red-500",
          !isRight && !isLeft && "bg-transparent",
        )}
        style={{ opacity: backgroundOpacity }}
      >
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium",
            isRight ? "bg-emerald-800/30" : "opacity-0",
            isExecuteThresholdReached && isRight && "animate-pulse",
          )}
        >
          <Check
            aria-hidden="true"
            className="h-5 w-5"
            style={{ transform: `scale(${iconScale})` }}
          />
          <span className="text-sm">{actionLabel}</span>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium",
            isLeft ? "bg-red-800/30" : "opacity-0",
            isExecuteThresholdReached && isLeft && "animate-pulse",
          )}
        >
          <span className="text-sm">{actionLabel}</span>
          <X
            aria-hidden="true"
            className="h-5 w-5"
            style={{ transform: `scale(${iconScale})` }}
          />
        </div>
      </div>

      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={deal.title ? `Deal ${deal.title}` : "Deal card"}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className={cn(
          "dash-border dash-bg-card relative z-10 touch-pan-y border select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shell-gold)] transition-shadow",
          gestureDisabled && "opacity-90",
          isDragging && "shadow-lg scale-[1.01] z-20",
          isExecuteThresholdReached && isDragging && "-translate-y-0.5 shadow-xl",
          "contrast-more:border-black",
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          transition,
          opacity: isCompleting ? 0 : 1,
          willChange: "transform",
        }}
      >
        {children}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announceText}
      </p>
    </div>
  );
}
