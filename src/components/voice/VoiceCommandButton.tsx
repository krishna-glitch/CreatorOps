"use client";

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useVoiceRecognition } from "@/src/hooks/useVoiceRecognition";
import { triggerHaptic } from "@/src/lib/utils/haptics";
import {
  type ParsedCommand,
  parseCommand,
} from "@/src/lib/voice/commandParser";
import { CommandConfirmation } from "./CommandConfirmation";

type VoiceCommandButtonProps = {
  brandVocabulary?: string[];
  disabled?: boolean;
  onExecuteCommand: (command: ParsedCommand) => Promise<void> | void;
  onInteractionChange?: (active: boolean) => void;
};

export function VoiceCommandButton({
  brandVocabulary = [],
  disabled,
  onExecuteCommand,
  onInteractionChange,
}: VoiceCommandButtonProps) {
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(
    null,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const voice = useVoiceRecognition({
    language: "en-US",
    phrases: brandVocabulary,
  });

  const finalTranscript = voice.transcript;
  const interimTranscript = voice.interimTranscript;
  const activeTranscript = useMemo(
    () => finalTranscript || interimTranscript,
    [finalTranscript, interimTranscript],
  );
  const isInteractionActive = voice.isListening || isConfirmOpen || isExecuting;

  useEffect(() => {
    onInteractionChange?.(isInteractionActive);
  }, [isInteractionActive, onInteractionChange]);

  useEffect(
    () => () => {
      onInteractionChange?.(false);
    },
    [onInteractionChange],
  );

  const handleStart = useCallback(() => {
    void voice.startListening();
  }, [voice]);

  const handleStop = useCallback(() => {
    voice.stopListening();
  }, [voice]);

  const handleTryAgain = useCallback(() => {
    setIsConfirmOpen(false);
    setPendingCommand(null);
    voice.reset();
    void voice.startListening();
  }, [voice]);

  const handleCancel = useCallback(() => {
    setIsConfirmOpen(false);
    setPendingCommand(null);
    voice.reset();
  }, [voice]);

  const handleExecute = useCallback(async () => {
    if (!pendingCommand || pendingCommand.intent === "UNKNOWN") {
      return;
    }

    setIsExecuting(true);
    await onExecuteCommand(pendingCommand);
    triggerHaptic(200, [40, 40, 120]);
    setIsExecuting(false);
    setIsConfirmOpen(false);
    setPendingCommand(null);
    voice.reset();
  }, [onExecuteCommand, pendingCommand, voice]);

  const handleReadyToConfirm = useCallback(() => {
    if (!finalTranscript) {
      return;
    }

    const parsed = parseCommand(finalTranscript, brandVocabulary);
    setPendingCommand(parsed);
    setIsConfirmOpen(true);
  }, [brandVocabulary, finalTranscript]);

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex max-w-[min(88vw,22rem)] flex-col items-end gap-2">
        {(activeTranscript || voice.error) && (
          <div className="w-full rounded-xl border dash-border bg-background/95 p-3 shadow-md backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {voice.isListening ? "Listening..." : "Voice input"}
            </p>
            {interimTranscript ? (
              <p className="mt-1 text-sm italic text-muted-foreground">
                {interimTranscript}
              </p>
            ) : null}
            {finalTranscript ? (
              <p className="mt-1 text-sm font-semibold text-foreground">
                {finalTranscript}
              </p>
            ) : null}
            {voice.error ? (
              <p className="mt-1 text-xs text-red-500">{voice.error}</p>
            ) : null}
            {!voice.isListening && finalTranscript ? (
              <Button
                type="button"
                size="sm"
                className="mt-2 h-8 px-3 text-xs"
                onClick={handleReadyToConfirm}
              >
                Review Command
              </Button>
            ) : null}
          </div>
        )}

        {voice.isListening ? (
          <div className="pointer-events-none flex items-center gap-2 rounded-full border dash-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <p className="text-xs text-muted-foreground">Listening...</p>
            <div className="flex items-end gap-0.5">
              <span className="h-2 w-1 animate-pulse rounded bg-foreground/70" />
              <span className="h-3 w-1 animate-pulse rounded bg-foreground/80 [animation-delay:100ms]" />
              <span className="h-4 w-1 animate-pulse rounded bg-foreground [animation-delay:200ms]" />
              <span className="h-3 w-1 animate-pulse rounded bg-foreground/80 [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          size="icon"
          className={`h-14 w-14 rounded-full shadow-lg ${voice.isListening ? "animate-pulse" : ""}`}
          onClick={voice.isListening ? handleStop : handleStart}
          disabled={disabled || !voice.isSupported}
          aria-label={
            voice.isListening
              ? "Stop voice recognition"
              : "Start voice recognition"
          }
        >
          {voice.isListening ? <MicOff /> : <Mic />}
        </Button>
      </div>

      <CommandConfirmation
        open={isConfirmOpen}
        transcript={finalTranscript}
        parsedCommand={pendingCommand}
        isExecuting={isExecuting}
        onExecute={() => {
          void handleExecute();
        }}
        onCancel={handleCancel}
        onTryAgain={handleTryAgain}
      />
    </>
  );
}
