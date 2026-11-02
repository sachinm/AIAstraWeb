import { describe, expect, it } from 'vitest';
import { THRESHOLDS, afterAsk, initialTier, nextTier, speechOverWebRtc, toSample, troubleIn, type QualitySample, type TierState } from './quality';

const good = (at: number): QualitySample => ({ at, connected: true, lossPct: 0, jitterMs: 5, rttMs: 40, kbps: 40, packets: 50 });
const lossy = (at: number): QualitySample => ({ ...good(at), lossPct: 12 });
const down = (at: number): QualitySample => ({ ...good(at), connected: false, packets: 0, kbps: 0 });

const run = (samples: QualitySample[], start: TierState = initialTier()): TierState => samples.reduce(nextTier, start);
const seconds = (from: number, to: number, make: (at: number) => QualitySample) => Array.from({ length: to - from }, (_, i) => make((from + i) * 1000));

describe('reading the counters', () => {
  const base = { at: 1000, connected: true, packetsReceived: 100, packetsLost: 0, bytesReceived: 1000, jitterSeconds: 0.01, rttSeconds: 0.05 };

  it('works out loss, bitrate, jitter and round trip for the window', () => {
    const s = toSample(base, { ...base, at: 2000, packetsReceived: 145, packetsLost: 5, bytesReceived: 6000 });
    expect(s.lossPct).toBe(10);
    expect(s.kbps).toBe(40);
    expect(s.jitterMs).toBe(10);
    expect(s.rttMs).toBe(50);
  });

  it('counts a silent call as total loss, not as perfect', () => {
    expect(toSample(base, { ...base, at: 2000 }).lossPct).toBe(100);
  });

  it('does not go negative when counters reset after a reconnect', () => {
    const s = toSample(base, { ...base, at: 2000, packetsReceived: 3, bytesReceived: 10 });
    expect(s.lossPct).toBe(100);
    expect(s.kbps).toBe(0);
  });
});

describe('what counts as trouble', () => {
  it.each([
    [{ lossPct: THRESHOLDS.lossPct }, 'loss'],
    [{ rttMs: THRESHOLDS.rttMs }, 'latency'],
    [{ jitterMs: THRESHOLDS.jitterMs }, 'jitter'],
    [{ connected: false }, 'disconnected'],
  ])('%j is %s', (over, reason) => {
    expect(troubleIn({ ...good(0), ...over })).toBe(reason);
  });

  it('a healthy call is none', () => {
    expect(troubleIn(good(0))).toBeNull();
  });
});

describe('dropping down', () => {
  it('stays live through a short bad spell', () => {
    expect(run(seconds(0, 4, lossy)).tier).toBe('live');
  });

  it('goes to the device voice after six seconds of trouble', () => {
    const s = run(seconds(0, 8, lossy));
    expect(s.tier).toBe('device');
    expect(s.reason).toBe('loss');
  });

  it('goes faster when the call actually drops', () => {
    expect(run(seconds(0, 5, down)).tier).toBe('device');
  });

  it('goes just as fast when nothing arrives, before WebRTC admits the path has died', () => {
    const silent = (at: number): QualitySample => ({ ...good(at), lossPct: 100, packets: 0, kbps: 0, silent: true });
    expect(run(seconds(0, 3, silent)).tier).toBe('live');
    expect(run(seconds(0, 5, silent)).tier).toBe('device');
  });

  it('is not reset by a single good second', () => {
    const flapping = [...seconds(0, 3, lossy), good(3000), ...seconds(4, 8, lossy)];
    expect(run(flapping).tier).toBe('device');
  });
});

describe('going back up', () => {
  const degraded = run(seconds(0, 8, lossy));

  it('waits fifteen good seconds', () => {
    expect(run(seconds(8, 20, good), degraded).tier).toBe('device');
    expect(run(seconds(8, 25, good), degraded).tier).toBe('live');
  });

  it('starts counting again after any trouble', () => {
    const s = run([...seconds(8, 20, good), lossy(20000), ...seconds(21, 30, good)], degraded);
    expect(s.tier).toBe('device');
  });

  it('climbs one step at a time from tapping', () => {
    const tap = initialTier('tap', 'ask');
    const once = run(seconds(0, 17, good), tap);
    expect(once.tier).toBe('device');
    expect(run(seconds(17, 34, good), once).tier).toBe('live');
  });

  it('does not bounce on a connection alternating good and bad', () => {
    let s = initialTier();
    const tiers: string[] = [];
    for (let i = 0; i < 90; i++) {
      s = nextTier(s, Math.floor(i / 3) % 2 ? good(i * 1000) : lossy(i * 1000));
      tiers.push(s.tier);
    }
    const changes = tiers.filter((t, i) => i > 0 && t !== tiers[i - 1]).length;
    expect(changes).toBeLessThanOrEqual(1);
    expect(s.tier).toBe('device');
  });
});

describe('with no way to get an answer', () => {
  it('falls to tapping after two failed answers with the call down', () => {
    let s = run(seconds(0, 5, down));
    s = afterAsk(s, false, false);
    expect(s.tier).toBe('device');
    s = afterAsk(s, false, false);
    expect(s.tier).toBe('tap');
    expect(s.reason).toBe('ask');
  });

  it('does not fall to tapping while the call still works', () => {
    expect(afterAsk(afterAsk(initialTier('device'), false, true), false, true).tier).toBe('device');
  });

  it('a success clears the count', () => {
    expect(afterAsk(afterAsk(initialTier('device'), false, false), true, false).askFailures).toBe(0);
  });
});

describe('the microphone over WebRTC', () => {
  it('is used until loss makes speech useless', () => {
    expect(speechOverWebRtc({ ...good(0), lossPct: 10 })).toBe(true);
    expect(speechOverWebRtc({ ...good(0), lossPct: THRESHOLDS.speechUnusableLossPct })).toBe(false);
    expect(speechOverWebRtc(down(0))).toBe(false);
    expect(speechOverWebRtc(null)).toBe(false);
  });
});
