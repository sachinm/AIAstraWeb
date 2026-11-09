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
