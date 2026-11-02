/**
 * Reads a WebRTC call's health, and decides how the voice agent should carry on: live voice, the device's own voice, or
 * tapped questions. Pure, so every rule is tested without a call. See docs/assistant/02 in the server repo.
 */

export type VoiceTier = 'live' | 'device' | 'tap';

/** One second of the call. */
export interface QualitySample {
  at: number;
  /** ICE and DTLS are up */
  connected: boolean;
  /** packets lost of those expected, this window, 0 to 100 */
  lossPct: number;
  jitterMs: number;
  rttMs: number | null;
  kbps: number;
  packets: number;
  /** audio the browser had to invent to cover gaps, this window, 0 to 100 */
  concealedPct?: number;
  /** how long audio waited in the jitter buffer, this window */
  bufferMs?: number;
  /** the call says it is up, but nothing arrived at all */
  silent?: boolean;
}

/** The running counters a sample is worked out from. */
export interface RawCounters {
  at: number;
  connected: boolean;
  packetsReceived: number;
  packetsLost: number;
  bytesReceived: number;
  jitterSeconds: number;
  rttSeconds: number | null;
  concealedSamples?: number;
  totalSamples?: number;
  bufferDelaySeconds?: number;
  bufferEmitted?: number;
}

export const THRESHOLDS = {
  /** at or over any of these, the call is in trouble */
  lossPct: 5,
  rttMs: 400,
  jitterMs: 60,
  /** how long trouble lasts before dropping to the device's voice */
  degradeAfterMs: 6000,
  /** dropped from WebRTC this long: no waiting for the rule above */
  disconnectedMs: 3000,
  /** failed answers over the web in a row, with the call also down, before the page answers by itself */
  askFailuresForTap: 2,
  /** how long things must stay good before going back up. Longer than a drop, so it does not flap. */
  recoverAfterMs: 15000,
  /** over this loss, the microphone over WebRTC is no use either */
  speechUnusableLossPct: 25,
} as const;

const growth = (now: number | undefined, prev: number | undefined): number => Math.max((now ?? 0) - (prev ?? 0), 0);

/** Packets flowing with nothing lost can still be silence from a dead call, so no packets at all counts as total loss. */
export function toSample(prev: RawCounters | null, now: RawCounters): QualitySample {
  const received = prev ? Math.max(now.packetsReceived - prev.packetsReceived, 0) : 0;
  const lost = prev ? Math.max(now.packetsLost - prev.packetsLost, 0) : 0;
  const expected = received + lost;
  const seconds = prev ? Math.max((now.at - prev.at) / 1000, 0.001) : 1;
  const bytes = prev ? Math.max(now.bytesReceived - prev.bytesReceived, 0) : 0;
  const silent = prev !== null && now.connected && expected === 0;
  const samples = growth(now.totalSamples, prev?.totalSamples);
  const emitted = growth(now.bufferEmitted, prev?.bufferEmitted);
  return {
    at: now.at,
    connected: now.connected,
    lossPct: silent ? 100 : expected ? (lost / expected) * 100 : 0,
    jitterMs: now.jitterSeconds * 1000,
    rttMs: now.rttSeconds === null ? null : now.rttSeconds * 1000,
    kbps: (bytes * 8) / 1000 / seconds,
    packets: received,
    silent,
    concealedPct: samples ? (growth(now.concealedSamples, prev?.concealedSamples) / samples) * 100 : 0,
    bufferMs: emitted ? (growth(now.bufferDelaySeconds, prev?.bufferDelaySeconds) / emitted) * 1000 : 0,
  };
}

export type TroubleReason = 'loss' | 'latency' | 'jitter' | 'disconnected';

/** Which rule a sample breaks, if any. */
export function troubleIn(s: QualitySample): TroubleReason | null {
  if (!s.connected) return 'disconnected';
  if (s.lossPct >= THRESHOLDS.lossPct) return 'loss';
  if (s.rttMs !== null && s.rttMs >= THRESHOLDS.rttMs) return 'latency';
  if (s.jitterMs >= THRESHOLDS.jitterMs) return 'jitter';
  return null;
}

export interface TierState {
  tier: VoiceTier;
  /** since when the current run of trouble, or of good, has lasted */
  troubleSince: number | null;
  goodSince: number | null;
  disconnectedSince: number | null;
  askFailures: number;
  /** why it is not live, for the log */
  reason: TroubleReason | 'ask' | 'mic' | 'start' | null;
}

export function initialTier(tier: VoiceTier = 'live', reason: TierState['reason'] = null): TierState {
  return { tier, troubleSince: null, goodSince: null, disconnectedSince: null, askFailures: 0, reason };
}

/**
 * A short smoothing window, so one bad second does not count against the whole run. A brief good sample does not end a run
 * of trouble either, or a connection flapping every few seconds would never degrade.
 */
const GOOD_RESETS_TROUBLE_AFTER_MS = 3000;

/** The next state, from one more second of the call. */
export function nextTier(state: TierState, s: QualitySample): TierState {
  const trouble = troubleIn(s);
  const next: TierState = { ...state };

  // WebRTC takes several seconds to admit a path has died, so nothing arriving counts as dropped straight away
  next.disconnectedSince = s.connected && !s.silent ? null : (state.disconnectedSince ?? s.at);

  if (trouble) {
    next.troubleSince = state.troubleSince ?? s.at;
    next.goodSince = null;
    if (state.tier === 'live') {
      const longEnough = s.at - next.troubleSince >= THRESHOLDS.degradeAfterMs;
      const droppedOut = next.disconnectedSince !== null && s.at - next.disconnectedSince >= THRESHOLDS.disconnectedMs;
      if (longEnough || droppedOut) {
        next.tier = 'device';
        next.reason = trouble;
      }
    }
    return next;
  }

  next.goodSince = state.goodSince ?? s.at;
  if (next.troubleSince !== null && s.at - next.goodSince >= GOOD_RESETS_TROUBLE_AFTER_MS) next.troubleSince = null;
  if (state.tier !== 'live' && s.at - next.goodSince >= THRESHOLDS.recoverAfterMs) {
    // one step at a time, so a recovering call proves itself at each
    next.tier = state.tier === 'tap' ? 'device' : 'live';
    next.goodSince = s.at;
    next.troubleSince = null;
    next.reason = next.tier === 'live' ? null : state.reason;
  }
  return next;
}

/** An answer over the web came back, or did not. Two failures with the call also down leaves only what is in the page. */
export function afterAsk(state: TierState, ok: boolean, connected: boolean): TierState {
  if (ok) return { ...state, askFailures: 0 };
  const askFailures = state.askFailures + 1;
  if (!connected && state.tier !== 'tap' && askFailures >= THRESHOLDS.askFailuresForTap) {
    return { ...state, askFailures, tier: 'tap', reason: 'ask', goodSince: null };
  }
  return { ...state, askFailures };
}

/** Whether the microphone over WebRTC is still worth using at this point. */
export function speechOverWebRtc(s: QualitySample | null): boolean {
  return !!s && s.connected && s.lossPct < THRESHOLDS.speechUnusableLossPct;
}
