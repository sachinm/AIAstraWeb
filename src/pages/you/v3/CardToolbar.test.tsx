import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardToolbar, { nextFace } from './CardToolbar';

function setup(over: Partial<React.ComponentProps<typeof CardToolbar>> = {}) {
  const spies = { onFace: vi.fn(), onTool: vi.fn(), onDetails: vi.fn() };
  render(<CardToolbar cardId="body" face="read" tools={['table']} {...spies} {...over} />);
  return spies;
}

describe('CardToolbar', () => {
  it('rotates through the faces: one is active, a click asks for another', () => {
    const { onFace } = setup();
    expect(screen.getByTestId('face-read')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('face-light')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('face-light'));
    expect(onFace).toHaveBeenCalledWith('light');
    fireEvent.click(screen.getByTestId('face-research'));
    expect(onFace).toHaveBeenLastCalledWith('research');
  });

  it('arrow keys move between faces', () => {
    const { onFace } = setup();
    fireEvent.keyDown(screen.getByTestId('face-switch'), { key: 'ArrowRight' });
    expect(onFace).toHaveBeenCalledWith('light');
    expect(nextFace('read', -1)).toBe('research');
    expect(nextFace('research', 1)).toBe('read');
  });

  it('tools are independent toggles that report which one was pressed', () => {
    const { onTool } = setup({ tools: ['table', 'plan'] });
    expect(screen.getByTestId('tool-table')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-plan')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-dates')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('tool-dates'));
    expect(onTool).toHaveBeenCalledWith('dates');
    fireEvent.click(screen.getByTestId('tool-table'));
    expect(onTool).toHaveBeenLastCalledWith('table');
  });

  it('every control has an accessible name', () => {
    setup();
    for (const t of ['table', 'calendar', 'dates', 'timeframe', 'plan', 'info']) expect(screen.getByTestId(`tool-${t}`)).toHaveAccessibleName();
    expect(screen.getByTestId('toolbar-details')).toHaveAccessibleName('Chart details');
  });

  it('Chart details is always there, in the full and the compact toolbar', () => {
    const { onDetails } = setup({ face: 'research' });
    fireEvent.click(screen.getByTestId('toolbar-details'));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('the compact toolbar keeps a face menu, the own-settings dot and the details button', () => {
    const { onFace, onDetails } = setup({ variant: 'compact', hasOwn: true });
    expect(screen.queryByTestId('face-switch')).toBeNull();
    expect(screen.getByTestId('toolbar-own-dot')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('face-select'), { target: { value: 'breakdown' } });
    expect(onFace).toHaveBeenCalledWith('breakdown');
    fireEvent.click(screen.getByTestId('toolbar-details'));
    expect(onDetails).toHaveBeenCalled();
  });
});
