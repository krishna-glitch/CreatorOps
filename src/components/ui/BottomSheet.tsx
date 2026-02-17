"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import React, { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/src/lib/utils/haptics";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = false,
}: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      triggerHaptic(50); // Haptic on open
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // If dragged down more than 100px or with high velocity, close it
    if (info.offset.y > 100 || info.velocity.y > 500) {
      triggerHaptic(30); // Subtle haptic on close
      onClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-sheet)] flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 200,
              restDelta: 0.5,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative z-10 w-full max-w-lg overflow-hidden rounded-t-[24px] bg-white shadow-2xl dark:bg-gray-900 pb-safe",
              className,
            )}
            style={{ maxHeight: "92vh" }}
          >
            {/* Drag Handle Area */}
            <div className="flex w-full flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-2">
                {title && (
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="overflow-y-auto px-6 pt-2 pb-8">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
