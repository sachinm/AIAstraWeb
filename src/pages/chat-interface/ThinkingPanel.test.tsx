import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ThinkingPanel from './ThinkingPanel';

const byId = (id: string): HTMLElement | null => document.querySelector(`[data-test-id="${id}"]`);
const open = () => byId('thinking-panel')!.getAttribute('data-open') === 'true';

describe('ThinkingPanel', () => {
  it('renders nothing without thinking text', () => {
    const { container } = render(<ThinkingPanel text="   " answering={false} working />);
    expect(container.firstChild).toBeNull();
  });

  it('is open while the answer is being prepared and shows the text', () => {
    render(<ThinkingPanel text={'**Checking** the 10th lord'} answering={false} working />);
    expect(open()).toBe(true);
    expect(byId('thinking-body')!.textContent).toMatch(/Checking the 10th lord/);
    expect(byId('thinking-toggle')!.textContent).toMatch(/Thinking/);
    expect(byId('thinking-toggle')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses on its own once the answer starts', () => {
    const { rerender } = render(<ThinkingPanel text="thinking" answering={false} working />);
    expect(open()).toBe(true);
    rerender(<ThinkingPanel text="thinking" answering working />);
    expect(open()).toBe(false);
    expect(byId('thinking-body')).toBeNull();
    expect(byId('thinking-toggle')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays collapsed for a finished reply and opens on click', () => {
    render(<ThinkingPanel text="earlier thoughts" answering working={false} />);
    expect(open()).toBe(false);
    fireEvent.click(byId('thinking-toggle')!);
    expect(open()).toBe(true);
    expect(byId('thinking-body')!.textContent).toMatch(/earlier thoughts/);
    fireEvent.click(byId('thinking-toggle')!);
    expect(open()).toBe(false);
  });

  it('keeps the panel open if the user opened it, even after the answer starts', () => {
    const { rerender } = render(<ThinkingPanel text="thinking" answering={false} working />);
    fireEvent.click(byId('thinking-toggle')!); // user closes it
    expect(open()).toBe(false);
    fireEvent.click(byId('thinking-toggle')!); // and opens it again
    rerender(<ThinkingPanel text="thinking" answering working />);
    expect(open()).toBe(true);
  });
});
