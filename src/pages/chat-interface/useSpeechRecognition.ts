import { useState, useRef, useCallback, useEffect } from 'react';

const SILENCE_MS = 2000; // 1–3 seconds per plan; use 2s

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
  return Ctor ?? null;
}

function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Apple/i.test(navigator.vendor) || /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
}

export interface UseSpeechRecognitionOptions {
  /** Called when transcript updates. Receives accumulated transcript from this session (finals + current interim). */
  onTranscript?: (transcript: string) => void;
  /** Language for recognition (e.g. "en-US"). */
  lang?: string;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  permissionDenied: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { onTranscript, lang = typeof document !== 'undefined' ? (document.documentElement.lang || 'en-US') : 'en-US' } = options;

  const [isListening, setIsListening] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimeoutRef.current !== null) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const scheduleSilenceStop = useCallback(
    (recognition: SpeechRecognition) => {
      clearSilenceTimer();
      silenceTimeoutRef.current = setTimeout(() => {
        silenceTimeoutRef.current = null;
        try {
          if (isApple()) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
          recognition.stop();
        } catch {
          // ignore
        }
        setIsListening(false);
      }, SILENCE_MS);
    },
    [clearSilenceTimer]
  );

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        if (isApple()) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
        recognition.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    let recognition: SpeechRecognition;
    try {
      recognition = new Ctor();
    } catch {
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let accumulated = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.length) {
          const t = result[0]?.transcript;
          if (t) accumulated += t;
        }
      }
      if (accumulated.trim() && onTranscript) {
        onTranscript(accumulated.trim());
      }
      scheduleSilenceStop(recognition);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer();
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionDenied(true);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      try {
        if (isApple()) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [lang, onTranscript, scheduleSilenceStop, clearSilenceTimer]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setPermissionDenied(false);
    setIsListening(true);

    try {
      recognition.start();
      scheduleSilenceStop(recognition);
    } catch (err) {
      setIsListening(false);
      const message = err instanceof Error ? err.message : String(err);
      if (/denied|not-allowed|permission/i.test(message)) {
        setPermissionDenied(true);
      }
    }
  }, [scheduleSilenceStop]);

  return {
    isListening,
    isSupported,
    permissionDenied,
    startListening,
    stopListening,
  };
}
