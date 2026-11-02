import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAP_ANSWERS, deviceSpeak } from './client';

class FakeUtterance {
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
  constructor(public text: string) {}
}

const fakeSynth = (over: Partial<SpeechSynthesis> = {}) => {
  const said: FakeUtterance[] = [];
  const synth = { speaking: false, cancel: vi.fn(), speak: (u: FakeUtterance) => said.push(u), ...over } as unknown as SpeechSynthesis;
  return { synth, said };
};

describe('the device voice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports finishing', async () => {
    const { synth, said } = fakeSynth();
    const p = deviceSpeak('hello', synth);
    said[0].onstart?.();
    said[0].onend?.();
    await expect(p).resolves.toBe('ended');
  });

  it('does not hang on a browser with no voice', async () => {
    await expect(deviceSpeak('hello', undefined)).resolves.toBe('unavailable');
  });

  it('counts the time for a line from when it starts, because lines queue', async () => {
    const { synth, said } = fakeSynth({ speaking: true });
    const p = deviceSpeak('hello', synth);
    await vi.advanceTimersByTimeAsync(9000);
    said[0].onstart?.();
    await vi.advanceTimersByTimeAsync(3000);
    said[0].onend?.();
    await expect(p).resolves.toBe('ended');
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it('clears a voice that never starts, so later lines can be heard', async () => {
    const { synth } = fakeSynth();
    const p = deviceSpeak('hello', synth);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(p).resolves.toBe('limit');
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('moves on from a queue that is busy without clearing it', async () => {
    const { synth } = fakeSynth({ speaking: true });
    const p = deviceSpeak('hello', synth);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(p).resolves.toBe('limit');
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it('clears a voice that starts and never finishes', async () => {
    const { synth, said } = fakeSynth();
    const p = deviceSpeak('hello', synth);
    said[0].onstart?.();
    await vi.advanceTimersByTimeAsync(4000);
    await expect(p).resolves.toBe('limit');
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('what it can say with no connection', () => {
  it('gives nothing away and reads nothing', () => {
    const words = TAP_ANSWERS.map((t) => `${t.question} ${t.answer}`).join(' ');
    expect(words).not.toMatch(/radha|pyjhora|ephemeris|dasha|ayanamsa|bedrock|nemotron/i);
  });

  it('matches the free plan on the pricing page', () => {
    expect(TAP_ANSWERS.find((t) => t.question.includes('free plan'))?.answer).toContain('twenty questions a month');
  });
});
