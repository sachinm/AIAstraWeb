/** Runs the real VoiceClient in a page, and records what a person would have heard. */
import { TAP_ANSWERS, VoiceClient, deviceSpeak, type VoiceEvent } from '../../src/lib/voice/client';

export type Recorded = VoiceEvent | { type: 'speech'; at: number; text: string; outcome: string; ms: number };

const events: Recorded[] = [];
let unsent: Recorded[] = [];

const record = (e: Recorded) => {
  events.push(e);
  unsent.push(e);
};

// for the live view only. The runner reads events directly, so a dead network loses nothing.
setInterval(() => {
  if (!unsent.length) return;
  const items = unsent;
  unsent = [];
  fetch('/report', { method: 'POST', body: JSON.stringify({ items }) }).catch(() => {
    unsent = items.concat(unsent).slice(-2000);
  });
}, 1000);

const failed = async (r: Response): Promise<Response> => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
};

const client = new VoiceClient({
  signaling: {
    send: async (message) => {
      await failed(await fetch('/signal/client', { method: 'POST', body: JSON.stringify(message) }));
    },
    receive: async () => (await failed(await fetch('/signal/client'))).json(),
  },
  ask: async (question) => {
    const r = await failed(await fetch('/ask', { method: 'POST', body: JSON.stringify({ question }), signal: AbortSignal.timeout(6000) }));
    return (await r.json()).answer;
  },
  speak: async (text) => {
    const t0 = Date.now();
    const outcome = await deviceSpeak(text);
    record({ type: 'speech', at: Date.now(), text, outcome, ms: Date.now() - t0 });
  },
  getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: true }),
  playRemote: (stream) => {
    (document.getElementById('heard') as HTMLAudioElement).srcObject = stream;
  },
  onEvent: record,
});

Object.assign(window, {
  voice: {
    start: () => client.start(),
    turn: (question: string) => client.turn(question),
    tier: () => client.tier,
    stop: () => client.stop(),
    events: () => events,
    tapQuestions: TAP_ANSWERS.map((t) => t.question),
  },
});
if (new URLSearchParams(location.search).has('autostart')) void client.start();
