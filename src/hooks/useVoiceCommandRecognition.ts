"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type UseVoiceCommandRecognitionOptions = {
  language?: string;
  minConfidence?: number;
  onTranscript: (transcript: string, confidence: number) => void;
};

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeConstructor =
    (
      window as typeof window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      }
    ).SpeechRecognition ??
    (
      window as typeof window & {
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;

  return maybeConstructor ?? null;
}

function getErrorMessage(errorCode: string) {
  if (errorCode === "not-allowed") {
    return "Microphone permission is blocked. Enable microphone access in browser settings.";
  }
  if (errorCode === "no-speech") {
    return "No speech detected. Try again in a quieter spot or move closer to the mic.";
  }
  if (errorCode === "audio-capture") {
    return "No microphone is available on this device.";
  }
  if (errorCode === "network") {
    return "Speech recognition failed due to a network error.";
  }

  return "Voice recognition failed. Please try again.";
}

export function useVoiceCommandRecognition(
  options: UseVoiceCommandRecognitionOptions,
) {
  const { onTranscript, language = "en-US", minConfidence = 0.55 } = options;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const permissionVerifiedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const isSupported = useMemo(() => Boolean(getRecognitionConstructor()), []);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const RecognitionCtor = getRecognitionConstructor();
    if (!RecognitionCtor) {
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let bestTranscript = "";
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result || !result.isFinal) {
          continue;
        }

        for (let j = 0; j < result.length; j += 1) {
          const alternative = result[j];
          if (!alternative) {
            continue;
          }

          const confidence =
            typeof alternative.confidence === "number"
              ? alternative.confidence
              : 0;
          const transcript =
            typeof alternative.transcript === "string"
              ? alternative.transcript.trim()
              : "";
          if (transcript.length === 0) {
            continue;
          }

          if (confidence >= bestConfidence || bestTranscript.length === 0) {
            bestConfidence = confidence;
            bestTranscript = transcript;
          }
        }
      }

      if (!bestTranscript) {
        setError("No speech detected. Try again.");
        return;
      }

      setLastTranscript(bestTranscript);
      if (
        bestConfidence > 0 &&
        bestConfidence < minConfidence &&
        bestTranscript.length < 10
      ) {
        setError(
          "Low-confidence audio in a noisy environment. Please repeat the command.",
        );
        return;
      }

      setError(null);
      onTranscriptRef.current(bestTranscript, bestConfidence);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(getErrorMessage(event.error ?? "unknown"));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [language, minConfidence]);

  const ensureMicrophonePermission = useCallback(async () => {
    if (permissionVerifiedRef.current) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    permissionVerifiedRef.current = true;
  }, []);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      setError("Voice recognition is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      await ensureMicrophonePermission();
      recognitionRef.current.start();
      setIsListening(true);
    } catch (_error) {
      setIsListening(false);
      setError(
        "Could not start voice recognition. Check microphone permissions and try again.",
      );
    }
  }, [ensureMicrophonePermission]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    error,
    lastTranscript,
    startListening,
    stopListening,
  };
}
