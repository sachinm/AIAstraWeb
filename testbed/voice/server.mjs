/**
 * The testbed's server: signalling between the two pages, and a UDP relay that breaks their call on purpose. Local only, never
 * in the product. Every packet of the call crosses the relay because each side is only ever told the relay's address.
 */
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** A bottleneck's queue: past this much waiting, packets drop, as on a real throttled link. */
const MAX_QUEUE_MS = 200;
const CLEAR = { lossPct: 0, delayMs: 0, jitterMs: 0, rateKbps: 0, blackout: false };

const emptyCounters = () => ({ packets: 0, bytes: 0, forwarded: 0, lost: 0, queueDropped: 0, blackedOut: 0, noPeer: 0 });

/** Points a candidate at the relay, or null for one the relay cannot carry (TCP, IPv6, unresolved mDNS names). */
export function rewriteCandidate(init, relayPort) {
  const text = init?.candidate;
  if (!text) return init;
  const parts = text.split(' ');
  // candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...
  if (parts.length < 8 || parts[2].toLowerCase() !== 'udp' || parts[4].includes(':') || parts[4].endsWith('.local')) return null;
  parts[5] = String(relayPort);
  return { ...init, candidate: parts.join(' ') };
}

/** SDP can carry candidates inline after an ICE restart. They would go around the relay, so they come out. */
export const stripSdpCandidates = (sdp) => ({ ...sdp, sdp: sdp.sdp.split(/\r?\n/).filter((l) => !l.startsWith('a=candidate:') && !l.startsWith('a=end-of-candidates')).join('\r\n') });

export async function startTestbed({ port = 0 } = {}) {
  const bundle = await build({ entryPoints: [path.join(HERE, 'client-page.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'silent' });
  const clientJs = bundle.outputFiles[0].text;

  let profile = { ...CLEAR };
  let askMode = { delayMs: 0, fail: false };
  let signalDown = false;
  let counters = { fromClient: emptyCounters(), fromAgent: emptyCounters() };
  let links = { fromClient: { busyUntil: 0 }, fromAgent: { busyUntil: 0 } };
  let mail = { client: [], agent: [] };
  let peers = { client: null, agent: null };
  let events = [];
  const timers = new Set();

  // the relay can only break the network as told while it is running. If this process stalls, packets pile up and burst, and
  // the call looks broken when it is the testbed at fault, so stalls are measured and the run can be thrown out.
  let longestStallMs = 0;
  let lastBeat = Date.now();
  const heartbeat = setInterval(() => {
    const now = Date.now();
    longestStallMs = Math.max(longestStallMs, now - lastBeat - 100);
    lastBeat = now;
  }, 100);

  const toClient = dgram.createSocket('udp4');
  const toAgent = dgram.createSocket('udp4');
  await Promise.all([new Promise((r) => toClient.bind(0, r)), new Promise((r) => toAgent.bind(0, r))]);
  const relayPort = { client: toClient.address().port, agent: toAgent.address().port };

  const carry = (dir, msg) => {
    const [out, peer] = dir === 'fromClient' ? [toAgent, peers.agent] : [toClient, peers.client];
    const c = counters[dir];
    if (!peer) {
      c.noPeer++;
      return;
    }
    c.forwarded++;
    out.send(msg, peer.port, peer.address);
  };

  const impair = (dir, msg) => {
    const c = counters[dir];
    c.packets++;
    c.bytes += msg.length;
    if (profile.blackout) {
      c.blackedOut++;
      return;
    }
    if (Math.random() * 100 < profile.lossPct) {
      c.lost++;
      return;
    }
    const now = Date.now();
    let wait = profile.delayMs + Math.random() * profile.jitterMs;
    if (profile.rateKbps > 0) {
      const link = links[dir];
      link.busyUntil = Math.max(link.busyUntil, now);
      if (link.busyUntil - now > MAX_QUEUE_MS) {
        c.queueDropped++;
        return;
      }
      link.busyUntil += msg.length / (profile.rateKbps / 8);
      wait += link.busyUntil - now;
    }
    if (wait < 1) {
      carry(dir, msg);
      return;
    }
    const t = setTimeout(() => {
      timers.delete(t);
      carry(dir, msg);
    }, wait);
    timers.add(t);
  };

  // each side's address comes from its own packets, so its latest socket is always the one answered
  toClient.on('message', (msg, from) => {
    peers.client = from;
    impair('fromClient', msg);
  });
  toAgent.on('message', (msg, from) => {
    peers.agent = from;
    impair('fromAgent', msg);
  });

  const deliver = (side, message) => {
    const other = side === 'client' ? 'agent' : 'client';
    if (message.candidate) {
      // the other side is told to send to the socket facing it
      const candidate = rewriteCandidate(message.candidate, relayPort[other]);
      if (candidate) mail[other].push({ candidate });
      return;
    }
    if (message.sdp) mail[other].push({ sdp: stripSdpCandidates(message.sdp) });
  };

  const body = (req) =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });

  const json = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(value));
  };

  const page = (res, file, type = 'text/html') => {
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(fs.readFileSync(path.join(HERE, file)));
  };

  const snapshot = () => ({ profile, askMode, signalDown, counters, events: events.slice(-1200) });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const signal = url.pathname.match(/^\/signal\/(client|agent)$/);
    if (signal) {
      if (signalDown) return json(res, 503, { error: 'down' });
      const side = signal[1];
      if (req.method === 'POST') {
        deliver(side, await body(req));
        return json(res, 200, { ok: true });
      }
      const messages = mail[side];
      mail[side] = [];
      return json(res, 200, messages);
    }
    if (url.pathname === '/ask') {
      const { question } = await body(req);
      if (askMode.delayMs) await new Promise((r) => setTimeout(r, askMode.delayMs));
      if (askMode.fail) return json(res, 503, { error: 'down' });
      return json(res, 200, { answer: `Stand-in answer to: ${String(question).slice(0, 80)}` });
    }
    if (url.pathname === '/state') return json(res, 200, snapshot());
    if (url.pathname === '/profile' && req.method === 'POST') {
      api.setProfile(await body(req));
      return json(res, 200, profile);
    }
    if (url.pathname === '/ask-mode' && req.method === 'POST') {
      askMode = { ...askMode, ...(await body(req)) };
      return json(res, 200, askMode);
    }
    if (url.pathname === '/report' && req.method === 'POST') {
      const { items } = await body(req);
      if (Array.isArray(items)) events.push(...items);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/client.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
      return res.end(clientJs);
    }
    if (url.pathname === '/client') return page(res, 'client.html');
    if (url.pathname === '/agent') return page(res, 'agent.html');
    if (url.pathname === '/') return page(res, 'control.html');
    return json(res, 404, { error: 'not found' });
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));

  const api = {
    url: `http://localhost:${server.address().port}`,
    setProfile(next) {
      profile = { ...CLEAR, ...next };
      links = { fromClient: { busyUntil: 0 }, fromAgent: { busyUntil: 0 } };
    },
    setAskMode(next) {
      askMode = { delayMs: 0, fail: false, ...next };
    },
    setSignalDown(down) {
      signalDown = down;
    },
    counters: () => JSON.parse(JSON.stringify(counters)),
    longestStallMs: () => longestStallMs,
    /** A clean slate between calls. */
    reset() {
      timers.forEach(clearTimeout);
      timers.clear();
      profile = { ...CLEAR };
      askMode = { delayMs: 0, fail: false };
      signalDown = false;
      counters = { fromClient: emptyCounters(), fromAgent: emptyCounters() };
      links = { fromClient: { busyUntil: 0 }, fromAgent: { busyUntil: 0 } };
      longestStallMs = 0;
      lastBeat = Date.now();
      mail = { client: [], agent: [] };
      peers = { client: null, agent: null };
      events = [];
    },
    async stop() {
      clearInterval(heartbeat);
      timers.forEach(clearTimeout);
      toClient.close();
      toAgent.close();
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
    },
  };
  return api;
}
