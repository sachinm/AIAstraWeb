import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COLD_BOARD_DEFAULTS } from '../../../lib/cardOptions';
import BoardSettings from './BoardSettings';
import { boardNow, clearOwn, ownCount, withBoardChange, withCardChange } from './boardOptions';
import { selfV3Fixture } from './selfV3.fixture';

function setup(own = 2) {
  const spies = { onChange: vi.fn(), onApplyAll: vi.fn() };
  render(<BoardSettings value={COLD_BOARD_DEFAULTS} ownCount={own} {...spies} />);
  fireEvent.click(screen.getByTestId('board-settings-open'));
  return spies;
}

describe('BoardSettings', () => {
  it('opens from the gear, which has a plain name', () => {
    render(<BoardSettings value={COLD_BOARD_DEFAULTS} ownCount={0} onChange={() => {}} onApplyAll={() => {}} />);
    expect(screen.getByTestId('board-settings-open')).toHaveAccessibleName('Card settings');
    expect(screen.queryByTestId('board-settings-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.getByTestId('board-settings-panel')).toBeInTheDocument();
  });

  it('"Apply to all cards" asks to clear the cards’ own settings, and is off when none keeps any', () => {
    const { onApplyAll } = setup(2);
    fireEvent.click(screen.getByTestId('bs-apply-all'));
    expect(onApplyAll).toHaveBeenCalledTimes(1);
  });

  it('is disabled when every card already follows the board', () => {
    const { onApplyAll } = setup(0);
    expect(screen.getByTestId('bs-apply-all')).toBeDisabled();
    fireEvent.click(screen.getByTestId('bs-apply-all'));
    expect(onApplyAll).not.toHaveBeenCalled();
  });

  it('reports a face, a tool, grouping, start, "Is this right?" and the turn animation', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByTestId('bs-face-light'));
    expect(onChange).toHaveBeenLastCalledWith({ face: 'light' });
    fireEvent.click(screen.getByTestId('bs-tool-calendar'));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]![0].tools).toContain('calendar');
    fireEvent.click(screen.getByTestId('bs-groupby-years'));
    expect(onChange).toHaveBeenLastCalledWith({ groupBy: 'years' });
    fireEvent.click(screen.getByTestId('bs-groupsas-accordion'));
    expect(onChange).toHaveBeenLastCalledWith({ groupsAs: 'accordion' });
    fireEvent.click(screen.getByTestId('bs-start-full'));
    expect(onChange).toHaveBeenLastCalledWith({ start: 'full' });
    fireEvent.click(screen.getByTestId('bs-confirm'));
    expect(onChange).toHaveBeenLastCalledWith({ confirm: !COLD_BOARD_DEFAULTS.confirm });
    fireEvent.click(screen.getByTestId('bs-motion'));
    expect(onChange).toHaveBeenLastCalledWith({ motion: !COLD_BOARD_DEFAULTS.motion });
  });

  it('Escape closes it', () => {
    setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('board-settings-panel')).toBeNull();
  });
});

describe('board options', () => {
  const layout = () => selfV3Fixture().layout;

  it('a card change keeps only the keys that differ from the board; back on the board’s own it leaves the map', () => {
    const l = layout();
    const once = withCardChange(l, 'body', { face: 'light' });
    expect(once).toEqual({ body: { face: 'light' } });
    expect(withCardChange({ ...l, options: once }, 'body', { face: boardNow(l).face })).toEqual({});
  });

  it('a board change keeps only the keys that differ from the server’s defaults', () => {
    expect(withBoardChange(layout(), { face: 'breakdown' })).toEqual({ face: 'breakdown' });
    expect(withBoardChange({ ...layout(), boardOptions: { face: 'breakdown' } }, { face: boardNow(layout()).face })).toEqual({});
  });

  it('Apply to all drops every card’s own choice', () => {
    const l = { ...layout(), options: { body: { face: 'light' as const }, mind: { tools: ['table' as const] } } };
    expect(ownCount(l)).toBe(2);
    expect(clearOwn(l)).toEqual({});
  });
});
