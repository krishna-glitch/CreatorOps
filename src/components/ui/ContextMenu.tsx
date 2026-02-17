"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/src/lib/utils/haptics";

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "cancel";
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  actions: ContextMenuAction[];
  title?: string;
}

export function ContextMenu({
  isOpen,
  position,
  onClose,
  actions,
  title,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      // Lock body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (menuRef.current.contains(event.target as Node)) {
        return;
      }
      setIsClosing(true);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
      }, 200);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200); // Match animation duration
  };

  const handleAction = (action: ContextMenuAction) => {
    triggerHaptic(50);
    action.onClick();
    handleClose();
  };

  if (!mounted || (!isOpen && !isClosing)) return null;

  // Calculate position logic to keep menu on screen
  // This is a simplified version; robust positioning might need useLayoutEffect
  // Adjust to center the menu around the touch point horizontally
  // and maintain a margin from screen edges
  const menuWidth = 280;
  let left = position.x - menuWidth / 2;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 375;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;

  if (left < 16) left = 16;
  if (left + menuWidth > viewportWidth - 16)
    left = viewportWidth - menuWidth - 16;

  // Check if we should show above or below
  let top = position.y + 20;
  const menuApproxHeight = actions.length * 56 + (title ? 40 : 0) + 20;

  if (!isMobile && top + menuApproxHeight > viewportHeight - 20) {
    top = position.y - menuApproxHeight - 20;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-start",
        // Backdrop
        "bg-black/20 backdrop-blur-sm transition-opacity duration-200",
        isClosing ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="options-menu"
        className={cn(
          "relative overflow-hidden bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-xl ring-1 ring-black/5 transition-all duration-200 ease-out dark:bg-zinc-900/90 dark:ring-white/10",
          isMobile
            ? "fixed inset-x-3 bottom-3 max-h-[85vh] rounded-2xl origin-bottom"
            : "rounded-2xl origin-center",
          isClosing
            ? isMobile
              ? "translate-y-4 opacity-0"
              : "scale-95 opacity-0"
            : isMobile
              ? "translate-y-0 opacity-100"
              : "animate-in fade-in zoom-in-95 scale-100 opacity-100",
        )}
        style={{
          ...(isMobile
            ? {}
            : {
                top,
                left,
                width: menuWidth,
                maxWidth: "90vw",
              }),
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {title}
          </div>
        )}
        <div className="flex flex-col p-1">
          {actions.map((action) => (
            <div key={`${action.label}-${action.variant ?? "default"}`}>
              <button
                type="button"
                onClick={() => handleAction(action)}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-[16px] font-medium transition-colors active:bg-zinc-100 dark:active:bg-zinc-800",
                  action.variant === "destructive" &&
                    "text-red-600 dark:text-red-400",
                  action.variant === "cancel" &&
                    "mt-1 justify-center bg-zinc-100 font-semibold text-zinc-900 active:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:active:bg-zinc-700",
                )}
              >
                <div className="flex items-center gap-3">
                  {action.icon}
                  <span>{action.label}</span>
                </div>
                {action.variant !== "cancel" && (
                  <ChevronRight className="h-4 w-4 text-zinc-400 opacity-50" />
                )}
              </button>
              {index < actions.length - 1 &&
                action.variant !== "cancel" &&
                actions[index + 1].variant !== "cancel" && (
                  <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800" />
                )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
