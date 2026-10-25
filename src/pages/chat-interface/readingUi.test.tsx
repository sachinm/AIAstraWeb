import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ClarifyCard from './ClarifyCard';
import { isNearBottom, loadSidebarPrefs, saveSidebarPrefs, shouldSendOnKey, SUBJECT_CHIPS, toClarifyView } from './readingUi';

describe('Enter to send', () => {
  it('Enter sends; Shift+Enter and IME composition do not', () => {
    expect(shouldSendOnKey({ key: 'Enter' })).toBe(true);
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: true })).toBe(false);
    expect(shouldSendOnKey({ key: 'Enter', nativeEvent: { isComposing: true } })).toBe(false);
    expect(shouldSendOnKey({ key: 'a' })).toBe(false);
  });
});

describe('scroll follow', () => {
  it('follows only within 120 px of the bottom', () => {
    expect(isNearBottom({ scrollTop: 880, scrollHeight: 1500, clientHeight: 500 })).toBe(true);
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1500, clientHeight: 500 })).toBe(false);
  });
});

describe('subject chips', () => {
  it('offer no remedies or mantras', () => {
    for (const c of SUBJECT_CHIPS) expect(c.question).not.toMatch(/remed|mantra|gemstone|health/i);
  });
});

describe('sidebar memory', () => {
  beforeEach(() => localStorage.clear());
  it('remembers open/closed per device and survives bad storage', () => {
    expect(loadSidebarPrefs({ leftOpen: false, rightOpen: false })).toEqual({ leftOpen: false, rightOpen: false });
    saveSidebarPrefs({ leftOpen: true, rightOpen: false });
    expect(loadSidebarPrefs({ leftOpen: false, rightOpen: true })).toEqual({ leftOpen: true, rightOpen: false });
    localStorage.setItem('aiastra.chat.sidebars', '{not json');
    expect(loadSidebarPrefs({ leftOpen: false, rightOpen: true })).toEqual({ leftOpen: false, rightOpen: true });
  });
});

describe('clarify events', () => {
  it('maps clarify, propose and declined events to card views', () => {
    expect(toClarifyView({ type: 'clarify', runId: 'r', question: 'Which period?', chips: [{ label: 'Next 6 months', value: '6m' }] })).toMatchObject({ type: 'clarify', runId: 'r', allowFreeText: true });
    expect(toClarifyView({ type: 'propose', runId: 'r', exactQuery: 'I will read: …' })).toMatchObject({ type: 'propose' });
    expect(toClarifyView({ type: 'declined', reply: 'AI Astra cannot help with that.' })).toMatchObject({ type: 'declined' });
    expect(toClarifyView({ type: 'stage' })).toBeNull();
  });
});

describe('ClarifyCard', () => {
  const view = { type: 'clarify' as const, runId: 'r1', question: 'Which period should I look at?', chips: [{ label: 'Next 6 months', value: '6m' }, { label: 'Next 12 months', value: '1y' }], allowFreeText: true, guidance: 'Ask about one area of life over a period.' };
  it('shows the question, guidance and chips; a chip sends its value', () => {
    const onChip = vi.fn();
    render(<ClarifyCard view={view} onChip={onChip} onText={vi.fn()} onConfirm={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText('Which period should I look at?')).toBeInTheDocument();
    expect(screen.getByText(/one area of life/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next 12 months'));
    expect(onChip).toHaveBeenCalledWith('1y', 'Next 12 months');
  });
  it('typed answers are sent and the box clears', () => {
    const onText = vi.fn();
    render(<ClarifyCard view={view} onChip={vi.fn()} onText={onText} onConfirm={vi.fn()} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Type your answer') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'until March' } });
    fireEvent.click(screen.getByText('Send'));
    expect(onText).toHaveBeenCalledWith('until March');
    expect(input.value).toBe('');
  });
  it('the proposal shows the exact query with confirm and change', () => {
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    render(<ClarifyCard view={{ type: 'propose', runId: 'r1', exactQuery: 'I will read: "When will I get married" over the next 6 months', assumed: 'I assumed the next 6 months.' }} onChip={vi.fn()} onText={vi.fn()} onConfirm={onConfirm} onChange={onChange} />);
    expect(screen.getByText(/I will read:/)).toBeInTheDocument();
    expect(screen.getByText('I assumed the next 6 months.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Yes, read it'));
    fireEvent.click(screen.getByText('Change'));
    expect(onConfirm).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
  });
  it('a declined reply is plain text with nothing to tap', () => {
    render(<ClarifyCard view={{ type: 'declined', reply: 'AI Astra does not answer questions about children under 18.' }} onChip={vi.fn()} onText={vi.fn()} onConfirm={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText(/children under 18/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('buttons are disabled while busy', () => {
    render(<ClarifyCard view={view} busy onChip={vi.fn()} onText={vi.fn()} onConfirm={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText('Next 6 months')).toBeDisabled();
  });
});
