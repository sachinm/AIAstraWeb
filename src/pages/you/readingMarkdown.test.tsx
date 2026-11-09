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
