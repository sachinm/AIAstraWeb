import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChatMainArea, { type ChatMainAreaProps } from './ChatMainArea';
import ReadingStagesPanel, { PANEL_FOLD_MS, PANEL_HIDE_DELAY_MS } from './ReadingStagesPanel';
import { applyReadingEvent, type ReadingProgress, type ReadingStreamEvent } from './readingProgress';
import type { UiMessage } from './chatThreadUtils';

/** The app tags elements with data-test-id (not Testing Library's data-testid). */
const byId = (root: ParentNode, id: string): HTMLElement | null => root.querySelector(`[data-test-id="${id}"]`);
const allById = (root: ParentNode, id: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(`[data-test-id="${id}"]`));
const mustId = (root: ParentNode, id: string): HTMLElement => {
  const el = byId(root, id);
  if (!el) throw new Error(`no element with data-test-id="${id}"`);
  return el;
};

const T0 = 1_000_000;

/** Fake server sequence of a multi-agent reading (as AIAstra_Server src/reading/run.ts + graph.ts emit it). */
const RUN: Array<[number, ReadingStreamEvent]> = [
  [0, { type: 'stage', name: 'intake', status: 'start' }],
  [10, { type: 'stage', name: 'intake', status: 'done', ms: 10 }],
  [20, { type: 'stage', name: 'prepare', status: 'start' }],
  [900, { type: 'stage', name: 'prepare', status: 'done', ms: 880 }],
  [910, { type: 'stage', name: 'promise', status: 'start', subject: 'career_work' }],
  [910, { type: 'stage', name: 'dasha', status: 'start', subject: 'career_work' }],
  [910, { type: 'stage', name: 'nakshatra', status: 'start', subject: 'career_work' }],
];

function progressAt(events: Array<[number, ReadingStreamEvent]>): ReadingProgress {
  let p: ReadingProgress | undefined;
  for (const [t, ev] of events) p = applyReadingEvent(p, ev, T0 + t);
  return p!;
}

const rows = () => allById(document, 'reading-stage-row');
const row = (name: string) => rows().find((r) => r.getAttribute('data-stage') === name)!;

describe('ReadingStagesPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 4000);
  });
  afterEach(() => vi.useRealTimers());

  it('shows every stage with its live state, the stage count and elapsed time', () => {
    render(<ReadingStagesPanel progress={progressAt(RUN)} working />);
    expect(rows().map((r) => r.getAttribute('data-stage'))).toEqual(['prepare', 'promise', 'dasha', 'nakshatra', 'reconcile', 'synthesize']);
    expect(row('prepare')).toHaveAttribute('data-status', 'done');
    expect(row('promise')).toHaveAttribute('data-status', 'start');
    expect(mustId(row('promise'), 'reading-stage-state')).toHaveTextContent('Running');
    expect(mustId(row('promise'), 'reading-stage-state')).toHaveTextContent('3.1 s');
    expect(row('reconcile')).toHaveAttribute('data-status', 'waiting');
    expect(mustId(row('synthesize'), 'reading-stage-state')).toHaveTextContent('Waiting');
    expect(mustId(document, 'reading-stages-count')).toHaveTextContent('1 of 6');
    expect(mustId(document, 'reading-stages-count')).toHaveTextContent('4.0 s');
    expect(screen.getByText('Preparing your reading')).toBeInTheDocument();
  });

  it('updates live as events arrive', () => {
    const { rerender } = render(<ReadingStagesPanel progress={progressAt(RUN)} working />);
    const more = progressAt([
      ...RUN,
      [3000, { type: 'stage', name: 'promise', status: 'done', ms: 2090, subject: 'career_work' }],
      [3100, { type: 'stage', name: 'dasha', status: 'done', ms: 2190, subject: 'career_work' }],
    ]);
    rerender(<ReadingStagesPanel progress={more} working />);
    expect(row('promise')).toHaveAttribute('data-status', 'done');
    expect(mustId(row('promise'), 'reading-stage-state')).toHaveTextContent('2.1 s');
    expect(mustId(document, 'reading-stages-count')).toHaveTextContent('3 of 6');
  });

  it('failed and skipped stages show their plain reason', () => {
    const p = progressAt([
      ...RUN,
      [19_000, { type: 'stage', name: 'nakshatra', status: 'skipped', ms: 18_090, subject: 'career_work' }],
      [37_000, { type: 'stage', name: 'dasha', status: 'failed', ms: 36_090, subject: 'career_work' }],
      [37_000, { type: 'stage', name: 'promise', status: 'failed', ms: 36_090, subject: 'career_work', reason: 'timeout', retried: true }],
    ]);
    render(<ReadingStagesPanel progress={p} working />);
    expect(row('dasha')).toHaveAttribute('data-status', 'failed');
    expect(mustId(row('dasha'), 'reading-stage-reason')).toHaveTextContent('Did not finish after a retry — reading confidence capped');
    expect(mustId(row('promise'), 'reading-stage-reason')).toHaveTextContent('Timed out after a retry — reading confidence capped');
    expect(row('nakshatra')).toHaveAttribute('data-status', 'skipped');
    expect(mustId(row('nakshatra'), 'reading-stage-reason')).toHaveTextContent(/^Skipped — optional check/);
    expect(byId(row('prepare'), 'reading-stage-reason')).toBeNull();
  });

  it('folds away ~1.5 s after the reading finishes', () => {
    const { rerender } = render(<ReadingStagesPanel progress={progressAt(RUN)} working />);
    rerender(<ReadingStagesPanel progress={progressAt(RUN)} working={false} />);
    // the stream ended with analysts still open: not presented as a finished reading
    expect(screen.getByText('Reading stopped')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PANEL_HIDE_DELAY_MS - 100));
    expect(mustId(document, 'reading-stages-panel')).toHaveAttribute('data-phase', 'live');
    act(() => vi.advanceTimersByTime(100));
    expect(mustId(document, 'reading-stages-panel')).toHaveAttribute('data-phase', 'folding');
    act(() => vi.advanceTimersByTime(PANEL_FOLD_MS));
    expect(byId(document, 'reading-stages-panel')).toBeNull();
  });

  it('with reduced motion it disappears without the fold step', () => {
    const mm = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', mm);
    try {
      const { rerender } = render(<ReadingStagesPanel progress={progressAt(RUN)} working />);
      rerender(<ReadingStagesPanel progress={progressAt(RUN)} working={false} />);
      act(() => vi.advanceTimersByTime(PANEL_HIDE_DELAY_MS));
      expect(byId(document, 'reading-stages-panel')).toBeNull();
      expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders nothing on the legacy path (no stage events)', () => {
    const { container } = render(<ReadingStagesPanel progress={undefined} working />);
    expect(container).toBeEmptyDOMElement();
  });
});

function areaProps(messages: UiMessage[], streamingMessageId: string | null): ChatMainAreaProps {
  return {
    messages,
    streamingMessageId,
    isTyping: false,
    askElapsedSec: 4,
    historyLoading: false,
    inputText: '',
    setInputText: () => {},
    onSend: () => {},
    onKeyDown: () => {},
    quickQuestions: [],
    isListening: false,
    isSupported: false,
    permissionDenied: false,
    onStartListening: () => {},
    onStopListening: () => {},
    inputDisabled: false,
  };
}

describe('stage panel in the chat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 4000);
  });
  afterEach(() => vi.useRealTimers());

  const user: UiMessage = { id: 'u1', sender: 'user', text: 'How is my career next year?', timestamp: '10:00' };
  const done = progressAt([
    ...RUN,
    [3000, { type: 'stage', name: 'promise', status: 'done', ms: 2090, subject: 'career_work' }],
    [3100, { type: 'stage', name: 'dasha', status: 'failed', ms: 2190, subject: 'career_work' }],
    [3100, { type: 'stage', name: 'nakshatra', status: 'done', ms: 2190, subject: 'career_work' }],
    [3200, { type: 'stage', name: 'reconcile', status: 'start' }],
    [3210, { type: 'stage', name: 'reconcile', status: 'done', ms: 10 }],
    [3220, { type: 'stage', name: 'synthesize', status: 'start' }],
    [9000, { type: 'stage', name: 'synthesize', status: 'done', ms: 5780 }],
  ]);

  it('sits above the message being written, outside the message body', () => {
    const ai: UiMessage = { id: 'a1', sender: 'ai', text: 'Your career…', timestamp: '10:01', progress: progressAt(RUN) };
    render(<ChatMainArea {...areaProps([user, ai], 'a1')} />);
    const panel = mustId(document, 'reading-stages-panel');
    const bubble = allById(document, 'chat-main-area-message-bubble')[1]!;
    expect(bubble).toHaveTextContent('Your career');
    expect(bubble.contains(panel)).toBe(false);
    expect(panel.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(byId(document, 'reading-made-toggle')).toBeNull();
  });

  it('hides after done without touching the message text, and the link re-opens the stage list', () => {
    const ai: UiMessage = { id: 'a1', sender: 'ai', text: 'Your career looks steady.', timestamp: '10:01', progress: done };
    const { rerender } = render(<ChatMainArea {...areaProps([user, ai], 'a1')} />);
    const bubble = allById(document, 'chat-main-area-message-bubble')[1]!;
    const textBefore = bubble.innerHTML;
    rerender(<ChatMainArea {...areaProps([user, ai], null)} />);
    expect(screen.getByText('Reading ready')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PANEL_HIDE_DELAY_MS + PANEL_FOLD_MS));
    expect(byId(document, 'reading-stages-panel')).toBeNull();
    // the same bubble element is still there; only the link was added under the text
    const bubbleAfter = allById(document, 'chat-main-area-message-bubble')[1]!;
    expect(bubbleAfter).toBe(bubble);
    expect(bubbleAfter.querySelector('p')!.textContent).toBe('Your career looks steady.');
    expect(textBefore).toContain('Your career looks steady.');

    const toggle = mustId(document, 'reading-made-toggle');
    expect(toggle).toHaveTextContent('How this reading was made');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(byId(document, 'reading-made-body')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = mustId(document, 'reading-made-body');
    expect(body).toHaveTextContent('6 of 6 stages');
    expect(allById(body, 'reading-stage-row').map((r) => r.getAttribute('data-status'))).toEqual(['done', 'done', 'failed', 'done', 'done', 'done']);
    expect(within(body).getByText('Did not finish after a retry — reading confidence capped')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(byId(document, 'reading-made-body')).toBeNull();
  });

  it('a finished answer loaded without a live run shows only the link', () => {
    const ai: UiMessage = { id: 'a1', sender: 'ai', text: 'Earlier answer', timestamp: '09:00', progress: done };
    render(<ChatMainArea {...areaProps([user, ai], null)} />);
    expect(byId(document, 'reading-stages-panel')).toBeNull();
    expect(mustId(document, 'reading-made-toggle')).toBeInTheDocument();
  });

  it('legacy answers (no progress) get neither panel nor link', () => {
    const ai: UiMessage = { id: 'a1', sender: 'ai', text: 'Plain answer', timestamp: '09:00' };
    render(<ChatMainArea {...areaProps([user, ai], null)} />);
    expect(byId(document, 'reading-stages-panel')).toBeNull();
    expect(byId(document, 'reading-made-toggle')).toBeNull();
  });
});
