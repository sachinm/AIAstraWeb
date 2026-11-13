/**
 * The picker's design on the Self board: the banner band, the chips-row thumb and the category classes. Decorative only
 * (aria-hidden, no words), the same colours as the picker, a gradient and glyph when no photo is loaded, nothing for an
 * unknown id.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SELF_CARD_GROUP } from '../../../components/boardCards/cardArtRegistry';
import CardChips from './CardChips';
import { CardBanner, CardThumb, cardAccentClass, cardGroupClass } from './CardBanner';

const photos = vi.hoisted(() => ({ url: null as string | null }));
vi.mock('../../../components/boardCards/cardPhotos', () => ({
  useCardPhoto: () => photos.url,
  useLoadCardPhotos: () => undefined,
}));

afterEach(() => {
  cleanup();
  photos.url = null;
});

describe('CardBanner', () => {
  it('renders the band for a known card, in its category colours, hidden from assistive technology and without words', () => {
    render(<CardBanner cardId="body" />);
    const band = screen.getByTestId('card-banner-body');
    expect(band).toHaveAttribute('aria-hidden', 'true');
    expect(band).toHaveAttribute('data-size', 'banner');
    expect(band).toHaveAttribute('data-art-theme', 'body');
    expect(band.className).toContain('card-banner');
    expect(band.textContent).toBe('');
    expect(band.querySelector('svg')).not.toBeNull();
  });

  it('takes the colour family of the card, not of its id', () => {
    render(
      <>
        <CardBanner cardId="stuck" />
        <CardBanner cardId="chapters" />
        <CardBanner cardId="presence" />
      </>,
    );
    expect(screen.getByTestId('card-banner-stuck')).toHaveAttribute('data-art-theme', 'mind');
    expect(screen.getByTestId('card-banner-chapters')).toHaveAttribute('data-art-theme', 'time');
    expect(screen.getByTestId('card-banner-presence')).toHaveAttribute('data-art-theme', 'character');
  });

  it('renders nothing, and never throws, for an unknown id', () => {
    const { container } = render(<CardBanner cardId="no_such_card" />);
    expect(container.firstChild).toBeNull();
    expect(render(<CardBanner cardId="" />).container.firstChild).toBeNull();
    expect(render(<CardBanner cardId="constructor" />).container.firstChild).toBeNull();
  });

  it('shows the gradient and glyph when no photo is loaded', () => {
    render(<CardBanner cardId="mind" />);
    const band = screen.getByTestId('card-banner-mind');
    expect(band).toHaveAttribute('data-photo', 'false');
    expect(band.querySelector('img')).toBeNull();
    expect(band.querySelector('.card-art-medallion svg')).not.toBeNull();
    expect(band.querySelector('.card-art-backdrop')).not.toBeNull();
  });

  it('shows the photo, the same path as the picker, when one is loaded', () => {
    photos.url = 'blob:photo-1';
    render(<CardBanner cardId="mind" />);
    const band = screen.getByTestId('card-banner-mind');
    expect(band).toHaveAttribute('data-photo', 'true');
    const img = within(band).getByTestId('card-banner-mind-photo');
    expect(img).toHaveAttribute('src', 'blob:photo-1');
    expect(img).toHaveAttribute('alt', '');
  });

  it('has a default height from CSS (72, or 56 on a short window) and takes an explicit px height', () => {
    const { rerender } = render(<CardBanner cardId="body" />);
    expect(screen.getByTestId('card-banner-body').style.height).toBe('');
    rerender(<CardBanner cardId="body" height={48} />);
    expect(screen.getByTestId('card-banner-body').style.height).toBe('48px');
  });

  it('stops the drift when motion is off', () => {
    const { rerender } = render(<CardBanner cardId="body" />);
    expect(screen.getByTestId('card-banner-body')).toHaveAttribute('data-motion', 'on');
    rerender(<CardBanner cardId="body" motion={false} />);
    expect(screen.getByTestId('card-banner-body')).toHaveAttribute('data-motion', 'off');
  });

  it('can leave the medallion off, for a card that prints its own icon', () => {
    render(<CardBanner cardId="body" medallion={false} />);
    expect(screen.getByTestId('card-banner-body').querySelector('.card-art-medallion')).toBeNull();
  });
});

describe('CardThumb and the category classes', () => {
  it('draws a 28 px square by default, a given size otherwise, hidden and wordless', () => {
    const { rerender } = render(<CardThumb cardId="sleep" />);
    const thumb = screen.getByTestId('card-thumb-sleep');
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
    expect(thumb).toHaveAttribute('data-art-theme', 'body');
    expect(thumb.style.width).toBe('28px');
    expect(thumb.style.height).toBe('28px');
    expect(thumb.textContent).toBe('');
    rerender(<CardThumb cardId="sleep" size={20} />);
    expect(screen.getByTestId('card-thumb-sleep').style.width).toBe('20px');
  });

  it('renders nothing for an unknown id', () => {
    expect(render(<CardThumb cardId="nope" />).container.firstChild).toBeNull();
  });

  it('gives each category its class names, and none for an unknown id', () => {
    expect(cardAccentClass('year')).toBe('card-grp-time card-accent card-art-glow');
    expect(cardGroupClass('saturn')).toBe('card-grp-indian');
    expect(cardAccentClass('nope')).toBe('');
    expect(cardGroupClass('nope')).toBe('');
  });

  it('maps every Self card to one of the five picker groups', () => {
    for (const g of Object.values(SELF_CARD_GROUP)) expect(['body', 'mind', 'character', 'indian', 'time']).toContain(g);
  });
});

describe('CardChips with art', () => {
  const props = {
    cards: ['year', 'body', 'mind'] as const,
    titles: { year: 'This year', body: 'Body & energy', mind: 'How you think' },
    activeId: 'body' as const,
    index: 1,
    onSelect: vi.fn(),
    onIndexChange: vi.fn(),
    onAdd: vi.fn(),
    onReset: vi.fn(),
    onEditDone: vi.fn(),
    onEditOrder: vi.fn(),
  };

  it('shows a thumb before each label, tints the active chip, and keeps the labels, roles and test ids', () => {
    const onSelect = vi.fn();
    render(<CardChips {...props} cards={[...props.cards]} onSelect={onSelect} editing={false} />);
    const tabs = within(screen.getByTestId('self-v3-chips')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['This year', 'Body & energy', 'How you think']);
    for (const id of ['year', 'body', 'mind']) {
      const chip = screen.getByTestId(`self-v3-chip-${id}`);
      expect(chip.firstElementChild).toBe(within(chip).getByTestId(`card-thumb-${id}`));
    }
    const active = screen.getByTestId('self-v3-chip-body');
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active.className).toContain('card-grp-body');
    expect(active.className).toContain('card-chip-on');
    expect(screen.getByTestId('self-v3-chip-mind').className).not.toContain('card-chip-on');
    fireEvent.click(screen.getByTestId('self-v3-chip-mind'));
    expect(onSelect).toHaveBeenCalledWith('mind');
    expect(screen.getByTestId('self-v3-chip-add')).toBeInTheDocument();
  });

  it('keeps the edit buttons working with the thumb in place', () => {
    const onEditOrder = vi.fn();
    render(<CardChips {...props} cards={[...props.cards]} onEditOrder={onEditOrder} editing />);
    expect(screen.getByTestId('self-v3-chip-body')).toContainElement(screen.getByTestId('card-thumb-body'));
    fireEvent.click(screen.getByTestId('chip-left-body'));
    expect(onEditOrder).toHaveBeenCalledWith(['body', 'year', 'mind']);
    expect(screen.getByTestId('chip-remove-body')).toBeDisabled();
  });
});
