/**
 * The voice agent's client: one WebRTC call, its health, and how a question gets answered at each tier. There is no text
 * input. Not mounted in the app yet: only the testbed (testbed/voice) uses it, until the live agent is approved.
 *
 *   live    agent's voice over WebRTC
 *   device  the words come over the web and the device's own voice says them
 *   tap     no connection: answers built into the page, said by the device's voice
 */
import { afterAsk, initialTier, nextTier, speechOverWebRtc, toSample, type QualitySample, type RawCounters, type TierState, type VoiceTier } from './quality';

export interface Signaling {
  /** throws when the agent's server cannot be reached */
  send(message: object): Promise<void>;
  /** messages since the last call */
  receive(): Promise<object[]>;
}

export interface VoiceClientDeps {
  signaling: Signaling;
  /** the words of an answer over the web; throws on failure */
  ask(question: string): Promise<string>;
  /** says the words in the device's voice; resolves when done, or when it gives up */
  speak(text: string): Promise<unknown>;
  getMicrophone(): Promise<MediaStream>;
  /** plays the agent's audio */
  playRemote?(stream: MediaStream): void;
  onEvent?(event: VoiceEvent): void;
  now?(): number;
  tickMs?: number;
  /** how long a live answer may take before the same question goes over the web */
  liveAnswerTimeoutMs?: number;
}

export type VoiceEvent =
  | { type: 'tier'; at: number; tier: VoiceTier; reason: TierState['reason']; from: VoiceTier }
  | { type: 'sample'; sample: QualitySample; tier: VoiceTier; input: 'webrtc' | 'recognizer' | 'tap' }
  | { type: 'answer'; at: number; question: string; answer: string; tier: VoiceTier; ms: number }
  | { type: 'unanswered'; at: number; question: string; tier: VoiceTier; why: string }
  | { type: 'connection'; at: number; state: string }
  | { type: 'note'; at: number; text: string };

/** Spoken once, the moment it drops. */
export const DEGRADED_LINE = "The connection is weak, so I'll keep this simple.";
export const NO_CONNECTION_LINE = 'The connection has gone. Tap a question and I can still answer those.';
/** One answer was lost, but the next may get through. */
export const RETRY_LINE = "Sorry, that didn't reach me. Please try again.";

/** With no connection these are all it can say: nothing about any chart, and nothing that goes out of date. */
export const TAP_ANSWERS: ReadonlyArray<{ question: string; answer: string }> = [
  { question: 'What can AdAstra AI help with?', answer: "With your birth details, readings can look at career, study, relationships, home, and the timing of life's chapters. It is for education and entertainment." },
  { question: 'Can you read my birth chart?', answer: "Not here. Sign up for an account, add your birth details, and let's look at it together." },
  { question: 'Can you answer questions about illness?', answer: 'No. AdAstra AI does not read health or give medical advice. For your health, please see a doctor.' },
  { question: 'Is there a free plan?', answer: 'Yes. There is a free plan of twenty questions a month.' },
];

const asked = (q: string): string => TAP_ANSWERS.find((t) => t.question === q)?.answer ?? TAP_ANSWERS[0].answer;

const RTC_CONFIG: RTCConfiguration = { iceServers: [], bundlePolicy: 'max-bundle' };

export class VoiceClient {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private prev: RawCounters | null = null;
  private lastSample: QualitySample | null = null;
  private state: TierState = initialTier();
  private pendingLive = new Map<string, (answer: string) => void>();
  /** signalling waiting for the server: a call started offline connects once the network returns */
  private outbox: object[] = [];
  private seq = 0;
  private stopped = false;
  private lastRestart = 0;

  constructor(private readonly d: VoiceClientDeps) {}

  private now(): number {
    return this.d.now?.() ?? Date.now();
  }

  get tier(): VoiceTier {
    return this.state.tier;
  }

  private emit(e: VoiceEvent): void {
    this.d.onEvent?.(e);
  }

  /** Moves between tiers, and says so once. */
  private apply(next: TierState): void {
    const from = this.state.tier;
    this.state = next;
    if (next.tier === from) return;
    this.emit({ type: 'tier', at: this.now(), tier: next.tier, reason: next.reason, from });
    if (next.tier === 'device' && from === 'live') void this.d.speak(DEGRADED_LINE);
    if (next.tier === 'tap') void this.d.speak(NO_CONNECTION_LINE);
  }

  /** Starts the call. Whatever goes wrong here, the person is left at a tier that works, never at an error. */
  async start(): Promise<void> {
    let mic: MediaStream;
    try {
      mic = await this.d.getMicrophone();
    } catch {
      // no microphone means nothing can be heard: only tapping works
      this.apply({ ...this.state, tier: 'tap', reason: 'mic' });
      return;
    }
    try {
      await this.connect(mic);
    } catch (err) {
      this.emit({ type: 'note', at: this.now(), text: `call failed to start: ${(err as Error).message}` });
      this.apply({ ...this.state, tier: 'device', reason: 'start' });
    }
    this.timers.push(setInterval(() => void this.measure(), this.d.tickMs ?? 1000));
    this.timers.push(setInterval(() => void this.exchangeSignals(), 500));
  }

  private async connect(mic: MediaStream): Promise<void> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;
    mic.getTracks().forEach((t) => pc.addTrack(t, mic));
    this.channel = pc.createDataChannel('turns', { ordered: true });
    this.channel.onmessage = (e) => this.onChannel(String(e.data));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.outbox.push({ candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      this.emit({ type: 'connection', at: this.now(), state: pc.connectionState });
      if (pc.connectionState === 'failed') void this.restartIce();
    };
    pc.ontrack = (e) => this.d.playRemote?.(e.streams[0] ?? new MediaStream([e.track]));
    await pc.setLocalDescription(await pc.createOffer());
    this.outbox.push({ sdp: pc.localDescription?.toJSON() });
  }

  /** A failed call does not recover alone; ask for a new path, no more than every ten seconds. */
  private async restartIce(): Promise<void> {
    if (!this.pc || this.stopped || this.now() - this.lastRestart < 10000) return;
    this.lastRestart = this.now();
    try {
      await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: true }));
      this.outbox.push({ sdp: this.pc.localDescription?.toJSON() });
      this.emit({ type: 'note', at: this.now(), text: 'ice restart' });
    } catch (err) {
      this.emit({ type: 'note', at: this.now(), text: `ice restart failed: ${(err as Error).message}` });
    }
  }

  private async exchangeSignals(): Promise<void> {
    if (!this.pc || this.stopped) return;
    try {
      while (this.outbox.length) {
        await this.d.signaling.send(this.outbox[0]);
        this.outbox.shift();
      }
      const messages = await this.d.signaling.receive();
      for (const m of messages as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }[]) {
        try {
          if (m.sdp) await this.pc.setRemoteDescription(m.sdp);
          if (m.candidate) await this.pc.addIceCandidate(m.candidate);
        } catch (err) {
          this.emit({ type: 'note', at: this.now(), text: `signal: ${(err as Error).message}` });
        }
      }
    } catch {
      // the server is out of reach: what is unsent stays in the outbox for the next try
    }
  }

  private async measure(): Promise<void> {
    if (this.stopped) return;
    const raw = this.pc ? await this.read(this.pc) : { at: this.now(), connected: false, packetsReceived: 0, packetsLost: 0, bytesReceived: 0, jitterSeconds: 0, rttSeconds: null };
    const sample = toSample(this.prev, raw);
    this.prev = raw;
    this.lastSample = sample;
    this.apply(nextTier(this.state, sample));
    if (this.pc?.connectionState === 'failed') void this.restartIce();
    this.emit({ type: 'sample', sample, tier: this.state.tier, input: this.inputNow() });
  }

  private async read(pc: RTCPeerConnection): Promise<RawCounters> {
    const out: RawCounters = { at: this.now(), connected: pc.connectionState === 'connected', packetsReceived: 0, packetsLost: 0, bytesReceived: 0, jitterSeconds: 0, rttSeconds: null, concealedSamples: 0, totalSamples: 0, bufferDelaySeconds: 0, bufferEmitted: 0 };
    const stats = await pc.getStats();
    stats.forEach((r: Record<string, unknown> & { type: string }) => {
      if (r.type === 'inbound-rtp' && r.kind === 'audio') {
        out.packetsReceived += Number(r.packetsReceived ?? 0);
        out.packetsLost += Number(r.packetsLost ?? 0);
        out.bytesReceived += Number(r.bytesReceived ?? 0);
        out.jitterSeconds = Math.max(out.jitterSeconds, Number(r.jitter ?? 0));
        out.concealedSamples = Number(out.concealedSamples) + Number(r.concealedSamples ?? 0);
        out.totalSamples = Number(out.totalSamples) + Number(r.totalSamplesReceived ?? 0);
        out.bufferDelaySeconds = Number(out.bufferDelaySeconds) + Number(r.jitterBufferDelay ?? 0);
        out.bufferEmitted = Number(out.bufferEmitted) + Number(r.jitterBufferEmittedCount ?? 0);
      }
      if (r.type === 'candidate-pair' && r.nominated && typeof r.currentRoundTripTime === 'number') out.rttSeconds = r.currentRoundTripTime as number;
    });
    return out;
  }

  /** How the person's voice is reaching the agent right now. */
  inputNow(): 'webrtc' | 'recognizer' | 'tap' {
    if (this.state.tier === 'tap') return 'tap';
    return speechOverWebRtc(this.lastSample) ? 'webrtc' : 'recognizer';
  }

  private onChannel(raw: string): void {
    try {
      const m = JSON.parse(raw) as { type?: string; id?: string; answer?: string };
      if (m.type === 'answer' && m.id) this.pendingLive.get(m.id)?.(m.answer ?? '');
    } catch {
      // not ours
    }
  }

  /** One question, by whichever way works. A person always gets an answer or a clear next step, never silence. */
  async turn(question: string): Promise<void> {
    const t0 = this.now();
    const done = (answer: string, tier: VoiceTier) => this.emit({ type: 'answer', at: this.now(), question, answer, tier, ms: this.now() - t0 });
    const callUp = () => this.pc?.connectionState === 'connected';

    if (this.state.tier === 'live') {
      const answer = await this.askLive(question);
      if (answer !== null) {
        done(answer, 'live');
        return;
      }
      this.emit({ type: 'note', at: this.now(), text: 'live answer timed out, asking over the web' });
    }
    if (this.state.tier !== 'tap') {
      try {
        const answer = await this.d.ask(question);
        this.apply(afterAsk(this.state, true, callUp()));
        await this.d.speak(answer);
        done(answer, 'device');
        return;
      } catch (err) {
        this.apply(afterAsk(this.state, false, callUp()));
        this.emit({ type: 'note', at: this.now(), text: `web answer failed: ${(err as Error).message}` });
      }
      // the web is down but the call may not be
      const overCall = await this.askLive(question);
      if (overCall !== null) {
        await this.d.speak(overCall);
        done(overCall, 'device');
        return;
      }
      // afterAsk above may have moved it down, which TypeScript cannot see
      if ((this.state.tier as VoiceTier) !== 'tap') {
        await this.d.speak(RETRY_LINE);
        this.emit({ type: 'unanswered', at: this.now(), question, tier: this.state.tier, why: 'no answer by either path' });
        return;
      }
    }
    const answer = asked(question);
    await this.d.speak(answer);
    done(answer, 'tap');
  }

  private askLive(question: string): Promise<string | null> {
    const channel = this.channel;
    if (!channel || channel.readyState !== 'open') return Promise.resolve(null);
    const id = String(++this.seq);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingLive.delete(id);
        resolve(null);
      }, this.d.liveAnswerTimeoutMs ?? 4000);
      this.pendingLive.set(id, (answer) => {
        clearTimeout(timer);
        this.pendingLive.delete(id);
        resolve(answer);
      });
      channel.send(JSON.stringify({ type: 'question', id, question }));
    });
  }

  stop(): void {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.channel?.close();
    this.pc?.close();
  }
}

export type SpeakOutcome = 'ended' | 'error' | 'limit' | 'unavailable';

/** How long a line may wait its turn behind others before the conversation moves on without waiting for it. */
const SPEECH_START_WAIT_MS = 10000;

/**
 * The device's voice, with limits: on some devices it never reports finishing, and a turn must not hang on that. The time for
 * saying the line counts from when it starts, because lines queue. A voice that has stopped responding is cleared, or nothing
 * after it would ever be heard.
 */
export function deviceSpeak(text: string, synth: SpeechSynthesis | undefined = typeof window === 'undefined' ? undefined : window.speechSynthesis): Promise<SpeakOutcome> {
  if (!synth) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    let limit: ReturnType<typeof setTimeout>;
    const end = (outcome: SpeakOutcome) => {
      clearTimeout(limit);
      resolve(outcome);
    };
    const stuck = () => {
      synth.cancel();
      end('limit');
    };
    limit = setTimeout(() => (synth.speaking ? end('limit') : stuck()), SPEECH_START_WAIT_MS);
    u.onstart = () => {
      clearTimeout(limit);
      limit = setTimeout(stuck, Math.max(4000, text.length * 90));
    };
    u.onend = () => end('ended');
    u.onerror = () => end('error');
    synth.speak(u);
  });
}
