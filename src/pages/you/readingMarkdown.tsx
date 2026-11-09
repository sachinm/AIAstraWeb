/**
 * The light markdown the Oracle writes its reading in, rendered for the person (server docs/reading-engine/64): headings,
 * paragraphs, bullet lists (also the inline "text: - **A**: … - **B**: …" shape the model produces), **bold**, *italic*;
 * horizontal rules, code ticks and leftover empty citations are dropped. No HTML from the text is ever rendered.
 */
import type { ReactNode } from 'react';

export type ReadingBlock = { kind: 'heading'; text: string } | { kind: 'paragraph'; text: string } | { kind: 'list'; lead: string | null; items: string[] };

/** Splits the reading into blocks. A paragraph with inline " - " bullets becomes a lead sentence plus a list. */
export function parseReadingBlocks(text: string): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  for (const raw of text.split(/\n{2,}/)) {
    const block = raw
      .replace(/`\s*`/g, '')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (!block || /^-{3,}$/.test(block)) continue;
    if (/^#{1,6}\s/.test(block)) {
      blocks.push({ kind: 'heading', text: block.replace(/^#{1,6}\s*/, '').trim() });
      continue;
    }
    // a short line with no sentence end, such as "In short (Diagnosis & Core Architecture)", is a heading too
    if (block.length <= 80 && !/[.!?]$/.test(block) && !/\n/.test(block) && !/^[-*•]/.test(block)) {
      blocks.push({ kind: 'heading', text: block });
      continue;
    }
    const lines = block.split('\n');
    const allBullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
    if (allBullets) {
      blocks.push({ kind: 'list', lead: null, items: lines.map((l) => l.replace(/^\s*[-*•]\s+/, '').trim()) });
      continue;
    }
    // "…clocks: - **Vimshottari**: … - **Jaimini**: …" on one line
    const parts = block.split(/(?:^|\s)-\s+(?=\*\*)/);
    if (parts.length >= 3) {
      const lead = parts[0]!.trim();
      blocks.push({ kind: 'list', lead: lead || null, items: parts.slice(1).map((s) => s.trim()).filter(Boolean) });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: block.replace(/\n+/g, ' ') });
  }
  return blocks;
}

/** **bold**, *italic*, `code` (shown plain). */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k++}>{m[2]}</em>);
    else out.push(m[3]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ReadingMarkdown({ text, testId = 'reading-markdown' }: { text: string; testId?: string }) {
  const blocks = parseReadingBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-3" data-testid={testId}>
      {blocks.map((b, i) => {
        if (b.kind === 'heading')
          return (
            <h4 key={i} className="pt-2 text-base font-semibold text-white">
              {renderInline(b.text)}
            </h4>
          );
        if (b.kind === 'list')
          return (
            <div key={i}>
              {b.lead && <p className="leading-relaxed text-white/85">{renderInline(b.lead)}</p>}
              <ul className="mt-1 list-disc space-y-1 pl-5 text-white/85">
                {b.items.map((it, j) => (
                  <li key={j} className="leading-relaxed">
                    {renderInline(it)}
                  </li>
                ))}
              </ul>
            </div>
          );
        return (
          <p key={i} className="leading-relaxed text-white/85">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

/** A dated statement found in the prose: the date or range and the sentence it sits in, for the panel's dates table. */
export type DatedStatement = { from: string; to: string | null; text: string };

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const DATE = '\\d{1,2} (?:' + MONTHS + ')[a-z]* \\d{4}';
const RANGE_RE = new RegExp('(' + DATE + ')\\s*(?:to|–|-|until|through|and)\\s*(' + DATE + ')', 'g');
const SINGLE_RE = new RegExp('(?:from|until|by|on|before|after|since|through)\\s+(' + DATE + ')', 'gi');
const ALL_DATES_RE = new RegExp(DATE, 'g');

/** Every sentence that carries a date or a date range, once each, in the order written. */
export function datedStatements(text: string): DatedStatement[] {
  const out: DatedStatement[] = [];
  const seen = new Set<string>();
  const plain = text.replace(/\*\*|\*|`/g, '');
  for (const sentence of plain.split(/(?<=[.!?])\s+|\n+/)) {
    const s = sentence.replace(/^[-•]\s*/, '').trim();
    if (!s) continue;
    const ranges = [...s.matchAll(RANGE_RE)];
    if (ranges.length) {
      for (const m of ranges) {
        const key = `${m[1]}|${m[2]}|${s}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: m[1]!, to: m[2]!, text: s });
      }
      continue;
    }
    // "Since 16 Nov 2025 and running through 1 Jan 2027": two dates joined by a reaching word make one range
    const all = [...s.matchAll(ALL_DATES_RE)];
    if (all.length >= 2) {
      const between = s.slice(all[0]!.index! + all[0]![0].length, all[1]!.index);
      if (/\b(to|through|until|till|up to)\b|[–-]/.test(between)) {
        const key = `${all[0]![0]}|${all[1]![0]}|${s}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: all[0]![0], to: all[1]![0], text: s });
        continue;
      }
    }
    const single = [...s.matchAll(SINGLE_RE)];
    const first = single[0]?.[1] ?? all[0]?.[0];
    if (first) {
      const key = `${first}|${s}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: first, to: null, text: s });
    }
  }
  return out;
}

/** The dates the section names, as a small table under its prose; nothing when the prose carries no date. */
export function DatesTable({ text, panelId }: { text: string; panelId: string }) {
  const rows = datedStatements(text);
  if (rows.length === 0) return null;
  return (
    <div className="mt-3" data-testid={`self-dates-${panelId}`}>
      <div className="text-xs uppercase tracking-wide text-white/55">Dates in this reading</div>
      <table className="mt-1 w-full text-left text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/10 align-top">
              <td className="whitespace-nowrap py-1.5 pr-3 text-white/70">{r.to ? `${r.from} – ${r.to}` : r.from}</td>
              <td className="py-1.5 text-white/85">{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
