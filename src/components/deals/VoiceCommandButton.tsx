"use client";

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceCommandRecognition } from "@/src/hooks/useVoiceCommandRecognition";

type VoiceCommandButtonProps = {
  onScrollDown?: () => void;
  onScrollUp?: () => void;
  onRefresh?: () => void;
  onSearch?: () => void;
  onTranscript?: (transcript: string) => void;
  isListening?: boolean;
  onListeningChange?: (isListening: boolean) => void;
  className?: string;
};

export function VoiceCommandButton({
  onScrollDown,
  onScrollUp,
  onRefresh,
  onSearch,
  onTranscript,
  isListening: externalIsListening,
  onListeningChange,
  className,
}: VoiceCommandButtonProps) {
  const [internalIsListening, setInternalIsListening] = useState(false);

  // Controlled or uncontrolled
  const isListening = externalIsListening ?? internalIsListening;
  const setIsListening = useCallback(
    (value: boolean) => {
      setInternalIsListening(value);
      onListeningChange?.(value);
    },
    [onListeningChange],
  );

  const {
    isSupported,
    isListening: hookIsListening,
    startListening,
    stopListening,
    error,
    lastTranscript,
  } = useVoiceCommandRecognition({
    onTranscript: (transcript) => {
      onTranscript?.(transcript);
      const command = transcript.toLowerCase();

      if (command.includes("scroll down") || command.includes("go down")) {
        onScrollDown?.();
        toast.info("Scrolling down...");
      } else if (command.includes("scroll up") || command.includes("go up")) {
        onScrollUp?.();
        toast.info("Scrolling up...");
      } else if (command.includes("refresh") || command.includes("reload")) {
        onRefresh?.();
        toast.info("Refreshing deals...");
      } else if (command.includes("search") || command.includes("find")) {
        onSearch?.();
        toast.info("Opening search...");
      }
    },
  });

  // Sync hook state with our state
  useEffect(() => {
    setIsListening(hookIsListening);
  }, [hookIsListening, setIsListening]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      stopListening();
    }
  }, [error, stopListening]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("creatorops.onboarding.used_voice", "true");
      }
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-40", className)}>
      <Button
        size="icon"
        variant={isListening ? "destructive" : "default"}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-all",
          isListening
            ? "animate-pulse ring-4 ring-red-500/30"
            : "hover:scale-105",
        )}
        onClick={toggleListening}
      >
        {isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
        <span className="sr-only">
          {isListening ? "Stop voice commands" : "Start voice commands"}
        </span>
      </Button>

      {isListening && lastTranscript && (
        <div className="absolute bottom-16 right-0 w-max max-w-[200px] rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
          {lastTranscript}
        </div>
      )}
    </div>
  );
}
