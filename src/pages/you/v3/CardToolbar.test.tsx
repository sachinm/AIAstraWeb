import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardToolbar, { FACES } from './CardToolbar';

describe('the face switch', () => {
  it('has exactly Read and Short', () => {
    render(<CardToolbar cardId="body" face="read" onFace={() => {}} />);
    expect(FACES).toEqual(['read', 'short']);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Read', 'Short']);
    expect(screen.getByTestId('face-read')).toHaveAttribute('aria-checked', 'true');
  });

  it('arrow keys move between the two faces and wrap', () => {
    const onFace = vi.fn();
    render(<CardToolbar cardId="body" face="short" onFace={onFace} />);
    fireEvent.keyDown(screen.getByTestId('face-switch'), { key: 'ArrowRight' });
    expect(onFace).toHaveBeenCalledWith('read');
  });

  it('marks a card that keeps its own choice', () => {
    render(<CardToolbar cardId="body" face="read" onFace={() => {}} hasOwn />);
    expect(screen.getByTestId('toolbar-own-dot')).toBeInTheDocument();
  });
});
