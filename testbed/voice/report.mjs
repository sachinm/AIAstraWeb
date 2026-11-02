/** A self-contained HTML report: no scripts, no outside files, so it can be opened anywhere. */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TIER_COLOR = { live: 'var(--live)', device: 'var(--device)', tap: 'var(--tap)' };

/** One metric over the call, with the tier as a band behind it. */
function chart(r, title, unit, pick, ceiling) {
  const samples = r.events.filter((e) => e.type === 'sample');
  if (!samples.length) return '';
  const W = 460;
  const H = 74;
  const x = (at) => ((at - r.t0) / (r.seconds * 1000)) * W;
  const values = samples.map((e) => pick(e.sample) ?? 0);
  const top = Math.max(ceiling, ...values) || 1;
  const y = (v) => H - (v / top) * (H - 4);
  const bands = samples.map((e, i) => {
    const next = samples[i + 1]?.sample.at ?? e.sample.at + 1000;
    return `<rect x="${x(e.sample.at).toFixed(1)}" y="0" width="${Math.max(x(next) - x(e.sample.at), 0.5).toFixed(1)}" height="${H}" fill="${TIER_COLOR[e.tier]}" opacity=".16"/>`;
  });
  const line = samples.map((e, i) => `${x(e.sample.at).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' ');
  const peak = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return `<figure><figcaption>${esc(title)} <span>mean ${avg.toFixed(1)}${unit}, peak ${peak.toFixed(1)}${unit}</span></figcaption>
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}">${bands.join('')}<polyline points="${line}" fill="none" stroke="var(--ink)" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg></figure>`;
}

function timeline(r) {
  const rows = r.events
    .filter((e) => e.type !== 'sample')
    .map((e) => {
      const sec = ((e.at - r.t0) / 1000).toFixed(1);
      if (e.type === 'tier') return [sec, `<b>${e.from} to ${e.tier}</b> because ${esc(e.reason)}`];
      if (e.type === 'answer') return [sec, `answered by ${e.tier} in ${e.ms} ms: ${esc(e.question)}`];
      if (e.type === 'unanswered') return [sec, `<b>told to try again</b>: ${esc(e.question)} (${esc(e.why)})`];
      if (e.type === 'speech') return [sec, `device voice (${esc(e.outcome)}, ${e.ms} ms): ${esc(e.text.slice(0, 80))}`];
      if (e.type === 'connection') return [sec, `connection ${esc(e.state)}`];
      return [sec, esc(e.text)];
    });
  return `<details><summary>Timeline (${rows.length})</summary><table>${rows.map(([s, t]) => `<tr><td>${s}s</td><td>${t}</td></tr>`).join('')}</table></details>`;
}

function relayLine(r) {
  const c = r.relay?.fromAgent;
  if (!c) return '';
  return `<p class="relay">Relay, agent to client: ${c.packets} packets, ${c.lost} dropped at random, ${c.queueDropped} dropped by the throttle, ${c.blackedOut} in blackouts.</p>`;
}

export function renderReport({ ranAt, results }) {
  const passed = results.filter((r) => r.passed).length;
  const cards = results
    .map(
      (r) => `<section class="${r.passed ? 'ok' : 'bad'}">
<h2><span class="flag">${r.passed ? 'Pass' : 'Fail'}</span> ${esc(r.name)}</h2>
<p>${esc(r.about)}. Ended on <b>${esc(r.tier ?? 'unknown')}</b>.</p>
<ul>${r.checks.map((c) => `<li class="${c.passed ? 'y' : 'n'}">${c.passed ? 'Yes' : 'No'}: ${esc(c.seen)}</li>`).join('')}</ul>
<div class="charts">
${chart(r, 'Loss', '%', (s) => s.lossPct, 10)}
${chart(r, 'Jitter', ' ms', (s) => s.jitterMs, 60)}
${chart(r, 'Round trip', ' ms', (s) => s.rttMs, 400)}
${chart(r, 'Bitrate', ' kbps', (s) => s.kbps, 60)}
${chart(r, 'Concealed audio', '%', (s) => s.concealedPct, 10)}
${chart(r, 'Jitter buffer', ' ms', (s) => s.bufferMs, 100)}
</div>
${relayLine(r)}
${timeline(r)}
</section>`
    )
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voice Testbed Report</title>
<style>
:root{--bg:#fff;--ink:#1c2230;--soft:#5b6474;--line:#dfe3ea;--live:#1f9d6b;--device:#d9902f;--tap:#c0453c}
@media (prefers-color-scheme:dark){:root{--bg:#10141c;--ink:#e6e9ef;--soft:#9aa3b2;--line:#2a3140}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:auto}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 4px}p{margin:4px 0}.sub,.relay{color:var(--soft)}
section{border:1px solid var(--line);border-left-width:4px;border-radius:6px;padding:14px;margin-top:14px}section.ok{border-left-color:var(--live)}section.bad{border-left-color:var(--tap)}
.flag{font-size:12px;font-weight:600;margin-right:6px}.ok .flag{color:var(--live)}.bad .flag{color:var(--tap)}
ul{margin:6px 0;padding-left:18px}li.n{color:var(--tap);font-weight:600}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin:10px 0}figure{margin:0}figcaption{font-size:13px;font-weight:600}figcaption span{font-weight:400;color:var(--soft)}
svg{display:block;width:100%;height:74px;border:1px solid var(--line);border-radius:3px}
.key span{display:inline-block;padding:0 8px;margin-right:6px;border-radius:3px}
details{margin-top:6px}summary{cursor:pointer;color:var(--soft)}table{border-collapse:collapse;font-size:13px;margin-top:6px}td{padding:1px 8px 1px 0;vertical-align:top}td:first-child{color:var(--soft);white-space:nowrap}
</style></head><body><main>
<h1>Voice testbed report</h1>
<p class="sub">${passed} of ${results.length} passed. Run at ${esc(ranAt)}. Real WebRTC calls in Chromium through a relay breaking the network on purpose.</p>
<p class="key">Band behind each chart: <span style="background:color-mix(in srgb,var(--live) 25%,transparent)">live</span><span style="background:color-mix(in srgb,var(--device) 25%,transparent)">device voice</span><span style="background:color-mix(in srgb,var(--tap) 25%,transparent)">tap</span></p>
${cards}
</main></body></html>`;
}
