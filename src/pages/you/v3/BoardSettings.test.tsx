import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COLD_BOARD_DEFAULTS } from '../../../lib/cardOptions';
import BoardSettings, { type BoardSettingsProps } from './BoardSettings';
import { boardNow, withBoardChange, withCardChange } from './boardOptions';
import { selfV3Fixture } from './selfV3.fixture';

function setup(extra: Partial<BoardSettingsProps> = {}) {
  const onChange = vi.fn();
  render(<BoardSettings value={COLD_BOARD_DEFAULTS} onChange={onChange} {...extra} />);
  fireEvent.click(screen.getByTestId('board-settings-open'));
  return { onChange };
}

describe('BoardSettings', () => {
  it('opens from the gear, which has a plain name', () => {
    render(<BoardSettings value={COLD_BOARD_DEFAULTS} onChange={() => {}} />);
    expect(screen.getByTestId('board-settings-open')).toHaveAccessibleName('Card settings');
    expect(screen.queryByTestId('board-settings-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.getByTestId('board-settings-panel')).toBeInTheDocument();
  });

  it('keeps only the default face, the voice and "Is this right?"', () => {
    setup({ voiceOn: true });
    expect(screen.getByTestId('bs-face')).toBeInTheDocument();
    expect(screen.getByTestId('bs-voice')).toBeInTheDocument();
    expect(screen.getByTestId('bs-confirm')).toBeInTheDocument();
    for (const gone of ['bs-tools', 'bs-groupby', 'bs-groupsas', 'bs-start', 'bs-motion', 'bs-apply-all', 'bs-own-count']) expect(screen.queryByTestId(gone)).toBeNull();
    expect(screen.queryByText(/Group by|Show groups as|Start cards|Open tools/)).toBeNull();
  });

  it('offers Read and Short only, Short stored as the face the server accepts', () => {
    const { onChange } = setup();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Read', 'Short']);
    fireEvent.click(screen.getByTestId('bs-face-short'));
    expect(onChange).toHaveBeenLastCalledWith({ face: 'light' });
  });

  it('hides the voice unless the server writes both voices', () => {
    setup();
    expect(screen.queryByTestId('bs-voice')).toBeNull();
  });

  it('reports the voice and "Is this right?"', () => {
    const { onChange } = setup({ voiceOn: true });
    fireEvent.click(screen.getByTestId('bs-voice-direct'));
    expect(onChange).toHaveBeenLastCalledWith({ voice: 'direct' });
    fireEvent.click(screen.getByTestId('bs-confirm'));
    expect(onChange).toHaveBeenLastCalledWith({ confirm: !COLD_BOARD_DEFAULTS.confirm });
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

  it('a board change keeps only the keys that differ from the server’s defaults, the voice included', () => {
    expect(withBoardChange(layout(), { face: 'light' })).toEqual({ face: 'light' });
    expect(withBoardChange({ ...layout(), boardOptions: { face: 'light' } }, { face: boardNow(layout()).face })).toEqual({});
    expect(withBoardChange(layout(), { voice: 'direct' })).toEqual({ voice: 'direct' });
    expect(withBoardChange(layout(), { voice: 'gentle' })).toEqual({});
  });
});
