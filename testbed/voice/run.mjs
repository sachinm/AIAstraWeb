/**
 * Real WebRTC calls through a broken network, one scenario at a time, each in a fresh browser. Writes report.json and report.html
 * beside this file, and exits non-zero if any scenario fails.
 *
 *   npm run voice:testbed                  every scenario
 *   npm run voice:testbed -- fast blackout only those whose name contains a word given
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BASE_FLAGS } from './flags.mjs';
import { renderReport } from './report.mjs';
import { startTestbed } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.VOICE_TESTBED_OUT || HERE;

const MAX_STALL_MS = 500;
const Q = ['What can AI AdAstra help with?', 'Can you read my birth chart?', 'Is there a free plan?', 'Can you answer questions about illness?'];

const samples = (r, from = 0, to = Infinity) => r.events.filter((e) => e.type === 'sample' && e.sample.at - r.t0 >= from * 1000 && e.sample.at - r.t0 < to * 1000).map((e) => e.sample);
const tiers = (r) => r.events.filter((e) => e.type === 'tier');
const answers = (r) => r.events.filter((e) => e.type === 'answer');
const unanswered = (r) => r.events.filter((e) => e.type === 'unanswered');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const atSec = (r, e) => Math.round((e.at - r.t0) / 100) / 10;

/** Each check returns [passed, what was seen]. */
const never = (r) => [tiers(r).length === 0, `${tiers(r).length} tier changes`];
const finalTier = (want) => (r) => [r.tier === want, `ended on ${r.tier}`];
/** Reached that tier by a time, and not before the network changed: an early drop is a fault too, not an early pass. */
const reached = (want, bySec, reasons, notBeforeSec = 0) => (r) => {
  const hit = tiers(r).find((t) => t.tier === want);
  if (!hit) return [false, `never reached ${want}`];
  const when = atSec(r, hit);
  const okReason = !reasons || reasons.includes(hit.reason);
  return [when <= bySec && when >= notBeforeSec && okReason, `${want} at ${when}s because ${hit.reason}`];
};
const backToLive = (bySec) => (r) => {
  const down = tiers(r).find((t) => t.tier !== 'live');
  const up = down && tiers(r).find((t) => t.tier === 'live' && t.at > down.at);
  return up ? [atSec(r, up) <= bySec, `back to live at ${atSec(r, up)}s`] : [false, 'never came back to live'];
};
const meanMetric = (key, from, to) => (r) => {
  const m = mean(samples(r, from, to).map((s) => s[key] ?? 0));
  return [true, `mean ${key} ${m.toFixed(1)}`];
};
const allAnswered = (r) => [unanswered(r).length === 0 && answers(r).length === r.asked, `${answers(r).length} of ${r.asked} answered`];
const someAnswered = (min) => (r) => [answers(r).length >= min, `${answers(r).length} of ${r.asked} answered, ${unanswered(r).length} told to retry`];
const answeredBy = (want) => (r) => {
  const wrong = answers(r).filter((a) => a.tier !== want);
  return [answers(r).length > 0 && wrong.length === 0, `tiers used: ${[...new Set(answers(r).map((a) => a.tier))].join(', ') || 'none'}`];
};
const anyAnsweredBy = (want) => (r) => [answers(r).some((a) => a.tier === want), `tiers used: ${[...new Set(answers(r).map((a) => a.tier))].join(', ') || 'none'}`];
const spokenLine = (fragment) => (r) => [r.events.some((e) => e.type === 'speech' && e.text.includes(fragment)), `said "${fragment}"`];
const measuredLoss = (from, to, low, high) => (r) => {
  const m = mean(samples(r, from, to).map((s) => s.lossPct));
  return [m >= low && m <= high, `browser measured ${m.toFixed(1)}% loss (want ${low} to ${high})`];
};
const injectedMatches = (r) => {
  const c = r.relay.fromAgent;
  const injected = c.packets ? ((c.lost + c.queueDropped) / c.packets) * 100 : 0;
  const measured = mean(samples(r, 3).map((s) => s.lossPct));
  return [Math.abs(injected - measured) <= 8, `relay dropped ${injected.toFixed(1)}%, browser measured ${measured.toFixed(1)}%`];
};
const callCarried = (r) => [r.relay.fromAgent.forwarded > 200 && r.relay.fromClient.forwarded > 200, `relay carried ${r.relay.fromAgent.forwarded} + ${r.relay.fromClient.forwarded} packets`];
const atMostChanges = (n) => (r) => [tiers(r).length <= n, `${tiers(r).length} tier changes`];

const at = (sec, fn) => ({ sec, fn });
const profile = (sec, p) => at(sec, ({ tb }) => tb.setProfile(p));
const ask = (...secs) => secs.map((sec, i) => at(sec, ({ turn }) => turn(Q[i % Q.length])));

const SCENARIOS = [
  { name: 'fast', about: 'A clean connection stays live throughout', seconds: 22, plan: [...ask(5, 10, 15)], checks: [callCarried, never, allAnswered, answeredBy('live'), measuredLoss(3, 22, 0, 1)] },
  { name: 'light loss 2%', about: 'Light loss is left alone', seconds: 22, plan: [profile(2, { lossPct: 2 }), ...ask(8, 14)], checks: [finalTier('live'), allAnswered, measuredLoss(4, 22, 0.5, 4.5)] },
  { name: 'loss 15%', about: 'Moderate loss drops to the device voice and still answers', seconds: 26, plan: [profile(3, { lossPct: 15 }), ...ask(16, 21)], checks: [reached('device', 14, ['loss'], 3), allAnswered, anyAnsweredBy('device'), spokenLine('connection is weak'), injectedMatches] },
  { name: 'loss 30%', about: 'Heavy loss also stops relying on the microphone over WebRTC', seconds: 26, plan: [profile(3, { lossPct: 30 }), ...ask(16, 21)], checks: [reached('device', 14, ['loss'], 3), injectedMatches, allAnswered, (r) => [r.events.some((e) => e.type === 'sample' && e.input === 'recognizer'), 'input moved to the recognizer']] },
  { name: 'high latency', about: 'A 900 ms round trip is too slow for conversation', seconds: 32, plan: [profile(3, { delayMs: 450 }), ...ask(24)], checks: [reached('device', 26, ['latency'], 3), meanMetric('rttMs', 8, 32), allAnswered] },
  { name: 'heavy jitter', about: 'Packets arriving unevenly', seconds: 30, plan: [profile(3, { jitterMs: 350 }), ...ask(22)], checks: [reached('device', 24, null, 3), meanMetric('jitterMs', 8, 30), meanMetric('lossPct', 8, 30), allAnswered] },
  { name: 'slow 64 kbps', about: 'A slow but steady line: voice needs little, so it should hold', seconds: 25, plan: [profile(3, { rateKbps: 64 }), ...ask(12, 18)], checks: [meanMetric('kbps', 5, 25), meanMetric('lossPct', 5, 25), allAnswered] },
  { name: 'slow 24 kbps', about: 'Too slow for audio: the words alone still get through', seconds: 25, plan: [profile(3, { rateKbps: 24 }), ...ask(16, 21)], checks: [reached('device', 15, null, 3), meanMetric('kbps', 5, 25), allAnswered, anyAnsweredBy('device')] },
  { name: 'fast then throttled', about: 'A good line throttled mid-call, then restored', seconds: 72, plan: [...ask(8), profile(14, { rateKbps: 16 }), ...ask(26, 32), profile(36, {}), at(68, ({ turn }) => turn(Q[3]))], checks: [reached('device', 26, null, 14), backToLive(66), finalTier('live'), allAnswered] },
  { name: 'short spike', about: 'A three-second bad patch does not end the live call', seconds: 20, plan: [profile(6, { lossPct: 40 }), profile(9, {}), ...ask(14)], checks: [never, allAnswered, answeredBy('live')] },
  { name: 'blackout 10s', about: 'Ten seconds of nothing, then the call comes back by itself', seconds: 55, plan: [...ask(8), profile(12, { blackout: true }), ...ask(18), profile(22, {}), ...ask(50)], checks: [reached('device', 18, null, 12), backToLive(48), finalTier('live'), allAnswered] },
  { name: 'no connection', about: 'The network goes for good: it falls to tapping, and still answers', seconds: 40, plan: [...ask(6), at(10, async ({ tb, context }) => { tb.setProfile({ blackout: true }); await context.setOffline(true); }), ...ask(16, 22, 28, 34)], checks: [reached('device', 15, null, 10), reached('tap', 32, ['ask']), finalTier('tap'), anyAnsweredBy('tap'), spokenLine('Tap a question'), someAnswered(3)] },
  { name: 'agent gone', about: 'The voice server dies but the website is fine', seconds: 32, plan: [...ask(6), at(10, async ({ agent }) => { await agent.close(); }), ...ask(20, 26)], checks: [reached('device', 18, null, 10), finalTier('device'), allAnswered, anyAnsweredBy('device')] },
  { name: 'offline at start', about: 'No network at all from the first moment, then it returns', seconds: 60, startOffline: true, plan: [...ask(6, 11, 16), at(20, async ({ tb, context }) => { tb.setProfile({}); tb.setSignalDown(false); await context.setOffline(false); }), ...ask(56)], checks: [reached('tap', 18), anyAnsweredBy('tap'), spokenLine('Tap a question'), backToLive(56), anyAnsweredBy('live'), finalTier('live')] },
  { name: 'microphone refused', about: 'The person says no to the microphone', seconds: 8, denyMic: true, plan: [...ask(3, 5)], checks: [reached('tap', 2, ['mic']), finalTier('tap'), allAnswered, answeredBy('tap')] },
  { name: 'flapping', about: 'A line swinging between good and bad every three seconds', seconds: 54, plan: Array.from({ length: 16 }, (_, i) => profile(3 + i * 3, i % 2 ? {} : { lossPct: 25 })), checks: [reached('device', 25, null, 3), atMostChanges(1)] },
  { name: 'slow answers', about: 'The call is poor and the answer server takes too long', seconds: 34, plan: [profile(2, { lossPct: 15 }), at(14, ({ tb }) => tb.setAskMode({ delayMs: 9000 })), ...ask(15), at(26, ({ tb }) => tb.setAskMode({})), ...ask(28)], checks: [(r) => [answers(r).length + unanswered(r).length === r.asked, `${answers(r).length} answered, ${unanswered(r).length} told to retry, ${r.asked} asked`], (r) => [answers(r).some((a) => a.at - r.t0 > 28000), 'recovered once answers were quick']] },
];

async function runScenario(tb, s) {
  tb.reset();
  const browser = await chromium.launch({ args: [...BASE_FLAGS, s.denyMic ? '--deny-permission-prompts' : '--use-fake-ui-for-media-stream', '--mute-audio'] });
  const pageErrors = [];
  const result = { name: s.name, about: s.about, seconds: s.seconds, checks: [], plan: [], asked: 0 };
  try {
    const context = await browser.newContext();
    const client = await context.newPage();
    client.on('pageerror', (e) => pageErrors.push(e.message));
    const agentContext = await browser.newContext();
    const agent = await agentContext.newPage();
    agent.on('pageerror', (e) => pageErrors.push(`agent: ${e.message}`));
    await agent.goto(`${tb.url}/agent`);
    await client.goto(`${tb.url}/client`);

    const turns = [];
    const turn = (question) => {
      result.asked++;
      turns.push(client.evaluate((q) => window.voice.turn(q), question).catch(() => undefined));
    };

    if (s.startOffline) {
      tb.setProfile({ blackout: true });
      tb.setSignalDown(true);
      await context.setOffline(true);
    }
    const t0 = Date.now();
    await client.evaluate(() => window.voice.start());

    for (const step of [...s.plan].sort((a, b) => a.sec - b.sec)) {
      const wait = t0 + step.sec * 1000 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await step.fn({ tb, context, client, agent, turn });
    }
    const wait = t0 + s.seconds * 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await Promise.race([Promise.all(turns), new Promise((r) => setTimeout(r, 15000))]);

    const events = await client.evaluate(() => window.voice.events());
    const tier = await client.evaluate(() => window.voice.tier());
    await client.evaluate(() => window.voice.stop()).catch(() => undefined);
    const r = { t0, events, tier, asked: result.asked, relay: tb.counters() };
    result.tier = tier;
    result.t0 = t0;
    result.events = events;
    result.relay = r.relay;
    for (const check of s.checks) {
      let passed = false;
      let seen = '';
      try {
        [passed, seen] = check(r);
      } catch (err) {
        seen = `check threw: ${err.message}`;
      }
      result.checks.push({ passed, seen });
    }
    if (pageErrors.length) result.checks.push({ passed: false, seen: `page errors: ${pageErrors.slice(0, 3).join(' | ')}` });
  } catch (err) {
    result.checks.push({ passed: false, seen: `scenario failed to run: ${err.message}` });
    result.events ??= [];
  } finally {
    await browser.close().catch(() => undefined);
  }
  result.passed = result.checks.length > 0 && result.checks.every((c) => c.passed);
  return result;
}

const words = process.argv.slice(2).map((w) => w.toLowerCase());
const chosen = words.length ? SCENARIOS.filter((s) => words.some((w) => s.name.includes(w))) : SCENARIOS;

const tb = await startTestbed();
const results = [];
try {
  for (const s of chosen) {
    // a stalled relay proves nothing about the agent, so that run is thrown out and tried again
    let r = await runScenario(tb, s);
    for (let retry = 0; retry < 2 && tb.longestStallMs() > MAX_STALL_MS; retry++) {
      console.log(`RERUN ${s.name}: the relay stalled for ${tb.longestStallMs()} ms`);
      r = await runScenario(tb, s);
    }
    if (tb.longestStallMs() > MAX_STALL_MS) {
      r.passed = false;
      r.checks.push({ passed: false, seen: `run invalid: the relay stalled for ${tb.longestStallMs()} ms each try` });
    }
    results.push(r);
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name}`);
    for (const c of r.checks) console.log(`   ${c.passed ? 'ok ' : 'NO '} ${c.seen}`);
    const speech = r.events.filter((e) => e.type === 'speech');
    if (speech.length) console.log(`   voice: ${[...new Set(speech.map((e) => e.outcome))].join(', ')}`);
  }
} finally {
  await tb.stop();
}
const report = { ranAt: new Date().toISOString(), results };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report));
fs.writeFileSync(path.join(OUT, 'report.html'), renderReport(report));
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} of ${results.length} passed. Report: ${path.join(OUT, 'report.html')}`);
process.exit(failed ? 1 : 0);
