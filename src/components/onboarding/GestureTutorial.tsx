"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hand, Mic, Smartphone, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const GESTURE_TUTORIAL_KEY = "creatorops-gesture-tutorial-v3";
const SWIPE_USED_KEY = "creatorops.onboarding.used_swipe";
const LONG_PRESS_USED_KEY = "creatorops.onboarding.used_long_press";
const VOICE_USED_KEY = "creatorops.onboarding.used_voice";

type TutorialStep = {
  id: "swipe" | "long-press" | "voice";
  title: string;
  description: string;
  icon: ReactNode;
  animation: ReactNode;
};

export function GestureTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);

  useEffect(() => {
    const allSteps: TutorialStep[] = [
      {
        id: "swipe",
        title: "Quick Actions",
        description: "Swipe right to Mark Paid, left to Cancel.",
        icon: <Smartphone className="h-10 w-10 text-blue-500" />,
        animation: (
          <div className="relative h-20 w-40 overflow-hidden rounded-xl border bg-card p-2 shadow-sm">
            <motion.div
              className="absolute inset-y-0 left-0 w-full bg-emerald-100/50"
              initial={{ x: "-100%" }}
              animate={{ x: ["-100%", "0%", "-100%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
            <div className="relative z-10 flex h-full items-center justify-center text-xs text-muted-foreground">
              Swipe Right
            </div>
            <motion.div
              className="absolute bottom-2 right-1/2 h-8 w-8 translate-x-1/2"
              animate={{
                x: [0, 60, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            >
              <Hand className="h-6 w-6 rotate-12 text-foreground/50" />
            </motion.div>
          </div>
        ),
      },
      {
        id: "long-press",
        title: "More Options",
        description: "Long press any card for context menu.",
        icon: <Hand className="h-10 w-10 text-purple-500" />,
        animation: (
          <div className="relative flex h-20 w-40 items-center justify-center rounded-xl border bg-card shadow-sm">
            <motion.div
              className="absolute h-12 w-12 rounded-full bg-purple-500/20"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs text-muted-foreground">Hold...</span>
          </div>
        ),
      },
      {
        id: "voice",
        title: "Voice Commands",
        description: "Tap the mic for hands-free control.",
        icon: <Mic className="h-10 w-10 text-red-500" />,
        animation: (
          <div className="relative flex h-20 w-40 items-center justify-center rounded-xl border bg-card shadow-sm">
            <div className="flex items-end gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-red-500"
                  animate={{ height: [10, 24, 10] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
    ];

    const swipeUsed = localStorage.getItem(SWIPE_USED_KEY) === "true";
    const longPressUsed = localStorage.getItem(LONG_PRESS_USED_KEY) === "true";
    const voiceUsed = localStorage.getItem(VOICE_USED_KEY) === "true";
    const hasSeenTutorial =
      localStorage.getItem(GESTURE_TUTORIAL_KEY) === "true";

    const filtered = allSteps.filter((item) => {
      if (item.id === "swipe") return !swipeUsed;
      if (item.id === "long-press") return !longPressUsed;
      return !voiceUsed;
    });

    if (filtered.length === 0) {
      localStorage.setItem(GESTURE_TUTORIAL_KEY, "true");
      return;
    }

    setSteps(filtered);
    if (!hasSeenTutorial) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem(GESTURE_TUTORIAL_KEY, "true");
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  if (!isOpen || steps.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-background p-6 shadow-xl"
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mt-4 flex flex-col items-center text-center">
            <div className="mb-6 flex h-32 w-full items-center justify-center rounded-2xl bg-muted/30">
              {steps[step]?.animation}
            </div>

            <h3 className="text-xl font-bold">{steps[step]?.title}</h3>
            <p className="mt-2 text-muted-foreground">
              {steps[step]?.description}
            </p>

            <div className="mt-8 flex w-full items-center justify-between gap-4">
              <div className="flex gap-1">
                {steps.map((tutorialStep, i) => (
                  <div
                    key={tutorialStep.title}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleDismiss}
                  className="rounded-full px-4"
                >
                  Skip
                </Button>
                <Button onClick={nextStep} className="rounded-full px-6">
                  {step === steps.length - 1 ? "Got it" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
