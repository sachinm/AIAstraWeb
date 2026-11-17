import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardToolbar, { FACES } from './CardToolbar';

describe('the face switch', () => {
  it('renders a radiogroup with Read and Short radio buttons and no legacy toolbar/tool buttons', () => {
    render(<CardToolbar cardId="body" face="read" onFace={() => {}} />);
    expect(FACES).toEqual(['read', 'short']);

    expect(screen.getByTestId('card-toolbar-body')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'How this card reads' });
    expect(group).toHaveAttribute('data-testid', 'face-switch');

    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Read', 'Short']);
    expect(screen.getByTestId('face-read')).toHaveAttribute('data-face', 'read');
    expect(screen.getByTestId('face-read')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('face-short')).toHaveAttribute('data-face', 'short');
    expect(screen.getByTestId('face-short')).toHaveAttribute('aria-checked', 'false');

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByTestId('tool-plan')).toBeNull();
    expect(screen.queryByTestId('toolbar-details')).toBeNull();
  });

  it('calls onFace when clicking Short or Read and reflects the selected face', () => {
    const onFace = vi.fn();
    const { rerender } = render(<CardToolbar cardId="body" face="read" onFace={onFace} />);

    fireEvent.click(screen.getByTestId('face-short'));
    expect(onFace).toHaveBeenCalledTimes(1);
    expect(onFace).toHaveBeenCalledWith('short');

    rerender(<CardToolbar cardId="body" face="short" onFace={onFace} />);
    expect(screen.getByTestId('face-short')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('face-read')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByTestId('face-read'));
    expect(onFace).toHaveBeenCalledTimes(2);
    expect(onFace).toHaveBeenLastCalledWith('read');
  });

  it('exposes a single tabIndex=0 roving stop and navigates/wraps across faces with arrow keys', () => {
    const onFace = vi.fn();
    const { rerender } = render(<CardToolbar cardId="body" face="read" onFace={onFace} />);

    const group = screen.getByRole('radiogroup');
    const radios = Array.from(group.querySelectorAll('button'));
    expect(radios.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByTestId('face-read')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('face-short')).toHaveAttribute('tabindex', '-1');

    screen.getByTestId('face-read').focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onFace).toHaveBeenLastCalledWith('short');
    expect(document.activeElement).toBe(screen.getByTestId('face-short'));

    rerender(<CardToolbar cardId="body" face="short" onFace={onFace} />);
    expect(screen.getByTestId('face-read')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('face-short')).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onFace).toHaveBeenLastCalledWith('read');
    expect(document.activeElement).toBe(screen.getByTestId('face-read'));

    rerender(<CardToolbar cardId="body" face="read" onFace={onFace} />);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onFace).toHaveBeenLastCalledWith('short');
    expect(document.activeElement).toBe(screen.getByTestId('face-short'));

    onFace.mockClear();
    fireEvent.keyDown(group, { key: 'Enter' });
    expect(onFace).not.toHaveBeenCalled();
  });

  it('marks a card that keeps its own choice with toolbar-own-dot and hides it otherwise', () => {
    const { rerender } = render(<CardToolbar cardId="body" face="read" onFace={() => {}} />);
    expect(screen.queryByTestId('toolbar-own-dot')).toBeNull();

    rerender(<CardToolbar cardId="body" face="read" onFace={() => {}} hasOwn />);
    const dot = screen.getByTestId('toolbar-own-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAccessibleName('This card has its own settings');
  });
});
