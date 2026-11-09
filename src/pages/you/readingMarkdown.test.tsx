import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseReadingBlocks, ReadingMarkdown } from './readingMarkdown';

const SAMPLE = `In short (Diagnosis & Core Architecture)

Your life is steered through a mirror: your Lagna is Pisces \`\`. Jupiter occupies the *Mrita* state \`\`.

---

Your chapters (All-Dasha Multi-System Timeline)

This progression is verified across all parallel clocks: - **Vimshottari**: Moon Mahadasha meets Venus \`\`. - **Jaimini Narayana**: Pisces Mahadasha \`\`. - **Yogini Dasha**: Venus running Sun \`\`.

- **Dhana Yoga**: Mars and the Moon in the 9th.
- **Neecha-Bhanga**: the Moon's debilitation cancelled.`;

describe('the Oracle reading as markdown', () => {
  it('parses headings, paragraphs, inline bullet runs and bullet lists; drops rules and empty citations', () => {
    const b = parseReadingBlocks(SAMPLE);
    expect(b.map((x) => x.kind)).toEqual(['heading', 'paragraph', 'heading', 'list', 'list']);
    expect(b[1]).toEqual({ kind: 'paragraph', text: 'Your life is steered through a mirror: your Lagna is Pisces. Jupiter occupies the *Mrita* state.' });
    expect(b[3]).toMatchObject({ lead: 'This progression is verified across all parallel clocks:', items: ['**Vimshottari**: Moon Mahadasha meets Venus.', '**Jaimini Narayana**: Pisces Mahadasha.', '**Yogini Dasha**: Venus running Sun.'] });
    expect(b[4]).toMatchObject({ lead: null, items: ['**Dhana Yoga**: Mars and the Moon in the 9th.', "**Neecha-Bhanga**: the Moon's debilitation cancelled."] });
  });
  it('renders bold and italic, never a raw asterisk, backtick or rule', () => {
    render(<ReadingMarkdown text={SAMPLE} />);
    const root = screen.getByTestId('reading-markdown');
    expect(within(root).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['In short (Diagnosis & Core Architecture)', 'Your chapters (All-Dasha Multi-System Timeline)']);
    expect(within(root).getByText('Vimshottari').tagName).toBe('STRONG');
    expect(within(root).getByText('Mrita').tagName).toBe('EM');
    expect(within(root).getAllByRole('list')).toHaveLength(2);
    expect(root.textContent).not.toMatch(/[*`]|---/);
  });
});

describe('datedStatements', () => {
  it('lists each dated sentence once with its range or single date, in order', async () => {
    const { datedStatements } = await import('./readingMarkdown');
    const rows = datedStatements('You are in the chapter of Rahu that runs until 16 Feb 2028. Since 16 Nov 2025 and running through 1 Jan 2027, Venus presses. - **Vimshottari**: Moon (16 Mar 2018 to 16 Mar 2028) meets Venus (14 Jan 2026 to 15 Sep 2027). No date here.');
    expect(rows.map((r) => [r.from, r.to])).toEqual([
      ['16 Feb 2028', null],
      ['16 Nov 2025', '1 Jan 2027'],
      ['16 Mar 2018', '16 Mar 2028'],
      ['14 Jan 2026', '15 Sep 2027'],
    ]);
    expect(rows[0]!.text).toBe('You are in the chapter of Rahu that runs until 16 Feb 2028.');
  });
});
