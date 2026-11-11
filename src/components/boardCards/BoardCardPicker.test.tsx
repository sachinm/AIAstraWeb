/**
 * The shared card picker (server docs/reading-engine/71 §4.1, §4.2): every tile has its category's art and glyph,
 * chosen / suggested / coming-soon look different and say so, the tray shows the board forming, and with options a
 * chosen tile opens "How this card reads" and Done sends the choices.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import BoardCardPicker, { type PickerCard } from './BoardCardPicker';
import { CARD_GLYPH, GROUP_ART } from './cardArtRegistry';

const CARDS: PickerCard[] = [
  { id: 'love_where', group: 'bond', title: 'Where love stands', description: 'The state of your bonds', suggested: true, available: true, unavailableReason: null },
  { id: 'love_meet', group: 'meeting', title: 'Meeting someone', description: 'When meeting is likely', suggested: true, available: true, unavailableReason: null },
  { id: 'love_friends', group: 'circle', title: 'Friendships', description: 'The friends who carry you', suggested: false, available: true, unavailableReason: null },
  { id: 'love_partner', group: 'meeting', title: 'The partner you draw', description: 'Who suits you', suggested: false, available: false, unavailableReason: 'Coming soon' },
];
const GROUPS = [
  { id: 'bond', title: 'You two' },
  { id: 'meeting', title: 'Meeting and waiting' },
  { id: 'circle', title: 'Family and friends' },
];

function renderPicker(over: Partial<Parameters<typeof BoardCardPicker>[0]> = {}) {
  const onDone = vi.fn();
  render(
    <BoardCardPicker
      board="love"
      title="Your cards"
      lead="Choose what you want to see."
      groups={GROUPS}
      cards={CARDS}
      initial={[]}
      minCards={1}
      suggestedCount={5}
      addSuggestedLabel="Add the suggested"
      note={(p) => (p.length ? '' : 'Pick at least one card.')}
      onDone={onDone}
      {...over}
    />,
  );
  return onDone;
}

describe('BoardCardPicker', () => {
  it('draws every tile with its category art, and every group with a banner', () => {
    renderPicker();
    expect(screen.getByTestId('card-art-love_where')).toHaveAttribute('data-art-theme', 'bond');
    expect(screen.getByTestId('card-art-love_meet')).toHaveAttribute('data-art-theme', 'meeting');
    expect(screen.getByTestId('card-art-love_friends')).toHaveAttribute('data-art-theme', 'circle');
    expect(screen.getByTestId('picker-group-meeting')).toHaveTextContent(GROUP_ART.meeting!.blurb);
    // no text is drawn inside the svg (exact words are never left to art)
    for (const svg of document.querySelectorAll('.card-art svg')) expect(svg.textContent).toBe('');
  });

  it('suggested, chosen and coming soon say so in words', () => {
    renderPicker();
    expect(within(screen.getByTestId('picker-tile-love_where')).getByTestId('picker-suggested')).toHaveTextContent('Suggested for you');
    const soon = screen.getByTestId('picker-tile-love_partner');
    expect(soon).toBeDisabled();
    expect(within(soon).getByTestId('picker-unavailable')).toHaveTextContent('Coming soon');
    expect(screen.getByTestId('picker-card-love_partner')).toHaveAttribute('data-state', 'soon');
    expect(screen.getByTestId('card-art-love_partner')).toHaveAttribute('data-muted', 'true');
    fireEvent.click(screen.getByTestId('picker-tile-love_friends'));
    expect(screen.getByTestId('picker-card-love_friends')).toHaveAttribute('data-state', 'on');
    expect(within(screen.getByTestId('picker-tile-love_friends')).getByTestId('picker-on-board')).toHaveTextContent('On your board');
  });

  it('the tray shows the board forming and removes a card on tap', () => {
    renderPicker();
    expect(screen.getByTestId('picker-tray')).toHaveTextContent('Your board is empty');
    fireEvent.click(screen.getByTestId('picker-add-suggested'));
    expect(screen.getByTestId('picker-count')).toHaveTextContent('2 chosen');
    expect(screen.getByTestId('picker-tray-love_where')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-tray-love_where'));
    expect(screen.getByTestId('picker-tile-love_where')).toHaveAttribute('aria-checked', 'false');
  });

  it('with options: a chosen tile opens "How this card reads" and Done sends only the chosen cards\' choices', () => {
    const onDone = renderPicker({ initial: ['love_meet'], options: { initial: { love_friends: { length: 'deep' } }, notes: { love_meet: ['This board has no plan lines yet.'] } } });
    expect(screen.queryByTestId('picker-options-love_friends')).toBeNull();
    fireEvent.click(screen.getByTestId('picker-options-love_meet'));
    const box = screen.getByTestId('card-options-love_meet');
    expect(box).toHaveTextContent('How this card reads');
    expect(box).toHaveTextContent('This board has no plan lines yet.');
    fireEvent.click(within(box).getByTestId('opt-love_meet-view-now'));
    expect(within(box).getByTestId('opt-love_meet-view-now')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('picker-done'));
    expect(onDone).toHaveBeenCalledWith(['love_meet'], { love_meet: { view: 'now' } });
  });

  it('Done waits for enough cards', () => {
    renderPicker({ minCards: 2 });
    expect(screen.getByTestId('picker-done')).toBeDisabled();
    expect(screen.getByTestId('picker-note')).toHaveTextContent('Pick at least one card.');
  });

  it('every Self, Love and Work card id has its own glyph', () => {
    const ids = ['body', 'fitness', 'sleep', 'blood', 'mind', 'sharpness', 'mood', 'stuck', 'restores', 'play', 'diagnosis', 'lagna', 'drive', 'presence', 'yogas', 'purpose', 'learning', 'constitution', 'layers', 'aims', 'practice', 'saturn', 'helps', 'chapter', 'chapters', 'year'];
    for (const id of ids) expect(CARD_GLYPH[id], id).toBeTruthy();
  });
});
