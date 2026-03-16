import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

function createMockRecognition() {
  const handlers: {
    onresult?: (e: SpeechRecognitionEvent) => void;
    onend?: () => void;
    onerror?: (e: SpeechRecognitionErrorEvent) => void;
  } = {};
  return {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: '',
    maxAlternatives: 1,
    set onresult(fn: (e: SpeechRecognitionEvent) => void) {
      handlers.onresult = fn;
    },
    get onresult() {
      return handlers.onresult ?? null;
    },
    set onend(fn: () => void) {
      handlers.onend = fn;
    },
    set onerror(fn: (e: SpeechRecognitionErrorEvent) => void) {
      handlers.onerror = fn;
    },
    _triggerResult(event: SpeechRecognitionEvent) {
      handlers.onresult?.(event);
    },
    _triggerEnd() {
      handlers.onend?.();
    },
    _triggerError(event: SpeechRecognitionErrorEvent) {
      handlers.onerror?.(event);
    },
  };
}

function createMockResult(transcript: string, isFinal = true): SpeechRecognitionResult {
  return {
    length: 1,
    isFinal,
    item: (i: number) => ({ transcript, confidence: 1 }),
    0: { transcript, confidence: 1 },
  } as unknown as SpeechRecognitionResult;
}

function createMockResultList(results: SpeechRecognitionResult[]): SpeechRecognitionResultList {
  return {
    length: results.length,
    item: (i: number) => results[i],
    ...Object.fromEntries(results.map((r, i) => [i, r])),
  } as unknown as SpeechRecognitionResultList;
}

function createMockResultEvent(transcript: string, isFinal = true): SpeechRecognitionEvent {
  return {
    resultIndex: 0,
    results: createMockResultList([createMockResult(transcript, isFinal)]),
  } as unknown as SpeechRecognitionEvent;
}

function createMockErrorEvent(error: string): SpeechRecognitionErrorEvent {
  return { error, message: error } as SpeechRecognitionErrorEvent;
}

describe('useSpeechRecognition', () => {
  const originalSpeechRecognition = (globalThis as unknown as Window).SpeechRecognition;
  const originalWebkit = (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as Window).SpeechRecognition = originalSpeechRecognition;
    (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = originalWebkit;
  });

  describe('when SpeechRecognition is not available', () => {
    beforeEach(() => {
      delete (globalThis as unknown as Window).SpeechRecognition;
      delete (globalThis as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    });

    it('returns isSupported: false and does not throw', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(false);
      expect(result.current.isListening).toBe(false);
      expect(result.current.permissionDenied).toBe(false);
    });

    it('startListening is a no-op and does not throw', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(() => act(() => result.current.startListening())).not.toThrow();
      expect(result.current.isListening).toBe(false);
    });
  });

  describe('when SpeechRecognition is available', () => {
    let mockRecognition: ReturnType<typeof createMockRecognition>;

    beforeEach(() => {
      vi.useFakeTimers();
      mockRecognition = createMockRecognition();
      const Ctor = vi.fn(() => mockRecognition);
      (globalThis as unknown as Window).SpeechRecognition = Ctor;
    });

    it('returns isSupported: true', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(true);
    });

    it('startListening calls recognition.start() and sets isListening', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      expect(mockRecognition.start).toHaveBeenCalled();
      expect(result.current.isListening).toBe(true);
    });

    it('stopListening calls recognition.stop() and clears isListening', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      expect(result.current.isListening).toBe(true);
      act(() => result.current.stopListening());
      expect(mockRecognition.stop).toHaveBeenCalled();
      expect(result.current.isListening).toBe(false);
    });

    it('onresult calls onTranscript with accumulated transcript', () => {
      const onTranscript = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));
      act(() => result.current.startListening());
      const event = createMockResultEvent('hello world', true);
      act(() => mockRecognition._triggerResult(event));
      expect(onTranscript).toHaveBeenCalledWith('hello world');
    });

    it('onerror with not-allowed sets permissionDenied', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      act(() => mockRecognition._triggerError(createMockErrorEvent('not-allowed')));
      expect(result.current.permissionDenied).toBe(true);
      expect(result.current.isListening).toBe(false);
    });

    it('onerror with service-not-allowed sets permissionDenied', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      act(() => mockRecognition._triggerError(createMockErrorEvent('service-not-allowed')));
      expect(result.current.permissionDenied).toBe(true);
    });

    it('silence timeout stops listening after SILENCE_MS', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      expect(result.current.isListening).toBe(true);
      act(() => vi.advanceTimersByTime(2000));
      expect(result.current.isListening).toBe(false);
      expect(mockRecognition.stop).toHaveBeenCalled();
    });

    it('silence timeout is reset when onresult fires', () => {
      const onTranscript = vi.fn();
      const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));
      act(() => result.current.startListening());
      act(() => vi.advanceTimersByTime(1000));
      act(() => mockRecognition._triggerResult(createMockResultEvent('hello', true)));
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.isListening).toBe(true);
      act(() => vi.advanceTimersByTime(1500));
      expect(result.current.isListening).toBe(false);
    });

    it('onend sets isListening to false', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      act(() => result.current.startListening());
      expect(result.current.isListening).toBe(true);
      act(() => mockRecognition._triggerEnd());
      expect(result.current.isListening).toBe(false);
    });
  });
});
