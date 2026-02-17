"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, MousePointer2, MoveHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function SwipeTutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasSeenTutorial = localStorage.getItem(
      "creatorops-swipe-tutorial-v1",
    );
    if (!hasSeenTutorial) {
      setIsVisible(true);
    }
  }, []);

  if (!mounted) return null;

  const handleDismiss = () => {
    localStorage.setItem("creatorops-swipe-tutorial-v1", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[var(--z-max)] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900"
        >
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
              <MoveHorizontal className="h-8 w-8" />
            </div>

            <h2 className="mb-2 text-xl font-bold">Try Swiping!</h2>
            <p className="mb-8 text-sm text-muted-foreground">
              Manage your deals faster with gestures.
            </p>

            <div className="space-y-4 text-left">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Swipe Right</p>
                  <p className="text-xs text-muted-foreground">Mark as Paid</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-red-100 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40">
                  <X className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Swipe Left</p>
                  <p className="text-xs text-muted-foreground">Cancel Deal</p>
                </div>
              </div>
            </div>

            <div className="relative mt-8 h-12 w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <motion.div
                animate={{ x: [0, 60, -60, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-blue-500"
              >
                <MousePointer2 className="h-8 w-8" />
              </motion.div>
            </div>

            <Button
              onClick={handleDismiss}
              className="mt-8 w-full rounded-2xl py-6 text-lg font-bold shadow-lg shadow-blue-500/20"
            >
              Got it!
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
