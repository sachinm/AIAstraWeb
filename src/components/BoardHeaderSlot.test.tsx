import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BoardHeaderSlot from './BoardHeaderSlot';

describe('BoardHeaderSlot (server docs/dashboards/09)', () => {
  it('renders the board controls into the header slot when the shell has one', () => {
    const slot = document.createElement('div');
    slot.setAttribute('data-board-header-slot', '');
    document.body.appendChild(slot);
    render(
      <div data-testid="board">
        <BoardHeaderSlot>
          <span data-testid="title">You</span>
        </BoardHeaderSlot>
      </div>,
    );
    expect(slot.contains(screen.getByTestId('title'))).toBe(true);
    expect(screen.getByTestId('board').contains(screen.getByTestId('title'))).toBe(false);
    slot.remove();
  });

  it('renders in place when there is no header slot (nothing is lost)', () => {
    render(
      <div data-testid="board">
        <BoardHeaderSlot>
          <span data-testid="title">You</span>
        </BoardHeaderSlot>
      </div>,
    );
    expect(screen.getByTestId('board').contains(screen.getByTestId('title'))).toBe(true);
  });
});
