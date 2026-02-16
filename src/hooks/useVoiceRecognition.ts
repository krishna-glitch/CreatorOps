"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { triggerHaptic } from "@/src/lib/utils/haptics";

type RecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]:
      | {
          isFinal: boolean;
          length: number;
          [altIndex: number]:
            | {
                transcript?: string;
                confidence?: number;
              }
            | undefined;
        }
      | undefined;
  };
};

type RecognitionErrorLike = {
  error?: string;
};

type BrowserRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;
type BrowserGrammarList = {
  addFromString: (grammar: string, weight?: number) => void;
};

type UseVoiceRecognitionOptions = {
  language?: string;
  silenceTimeoutMs?: number;
  phrases?: string[];
  onFinalTranscript?: (transcript: string) => void;
};

function getSpeechRecognitionConstructor(): BrowserRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeRecognition =
    (
      window as typeof window & {
        SpeechRecognition?: BrowserRecognitionConstructor;
      }
    ).SpeechRecognition ??
    (
      window as typeof window & {
        webkitSpeechRecognition?: BrowserRecognitionConstructor;
      }
    ).webkitSpeechRecognition;

  return maybeRecognition ?? null;
}

function mapErrorMessage(code: string) {
  if (code === "not-allowed") {
    return "Enable microphone in browser settings";
  }
  if (code === "audio-capture") {
    return "No microphone found on this device";
  }
  if (code === "no-speech") {
    return "No speech detected. Try again.";
  }
  if (code === "network") {
    return "Network error while recognizing speech";
  }
  if (code === "aborted") {
    return "Voice recognition stopped";
  }

  return "Voice recognition failed";
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    language = "en-US",
    silenceTimeoutMs = 5000,
    phrases = [],
    onFinalTranscript,
  } = options;
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSupported = Boolean(getSpeechRecognitionConstructor());

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const scheduleSilenceStop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      recognitionRef.current?.stop();
      setIsListening(false);
      setError("No speech timeout. Try again.");
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs]);

  useEffect(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    const grammarListCtor =
      (
        window as typeof window & {
          SpeechGrammarList?: new () => BrowserGrammarList;
        }
      ).SpeechGrammarList ??
      (
        window as typeof window & {
          webkitSpeechGrammarList?: new () => BrowserGrammarList;
        }
      ).webkitSpeechGrammarList;
    if (grammarListCtor && phrases.length > 0) {
      try {
        const list = new grammarListCtor();
        const jsgf = `#JSGF V1.0; grammar brands; public <brand> = ${phrases.join(" | ")} ;`;
        if (typeof list.addFromString === "function") {
          list.addFromString(jsgf, 1);
          (
            recognition as BrowserRecognition & {
              grammars?: unknown;
            }
          ).grammars = list;
        }
      } catch (_error) {
        console.debug("[voice] grammar injection not supported");
      }
    }

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      scheduleSilenceStop();
      triggerHaptic(50);
      console.debug("[voice] listening started");
    };

    recognition.onresult = (event) => {
      scheduleSilenceStop();
      let nextInterim = "";
      let nextFinal = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (!result) {
          continue;
        }

        for (let altIndex = 0; altIndex < result.length; altIndex += 1) {
          const alt = result[altIndex];
          if (!alt?.transcript) {
            continue;
          }

          if (result.isFinal) {
            nextFinal = `${nextFinal} ${alt.transcript}`.trim();
          } else {
            nextInterim = `${nextInterim} ${alt.transcript}`.trim();
          }
          break;
        }
      }

      if (nextInterim) {
        setInterimTranscript(nextInterim);
      }

      if (nextFinal) {
        setTranscript(nextFinal);
        setInterimTranscript("");
        triggerHaptic(100);
        console.debug("[voice] final transcript received");
        onFinalTranscriptRef.current?.(nextFinal);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      clearSilenceTimer();
      const nextError = mapErrorMessage(event.error ?? "unknown");
      setError(nextError);
      if (event.error === "no-speech") {
        console.debug("[voice] no-speech detected, likely background noise");
      } else {
        console.debug("[voice] recognition error", event.error ?? "unknown");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      clearSilenceTimer();
      console.debug("[voice] listening ended");
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer, language, phrases, scheduleSilenceStop]);

  const startListening = useCallback(async () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("Voice commands not supported");
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    } catch (_error) {
      setError("Enable microphone in browser settings");
      return;
    }

    setTranscript("");
    setInterimTranscript("");
    setError(null);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    clearSilenceTimer();
    setIsListening(false);
  }, [clearSilenceTimer]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    reset,
    isSupported,
  };
}
