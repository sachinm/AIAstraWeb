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
  it('tablet and desktop: "Cards across: Auto · 1 · 2 · 3 · 4", Auto by default', () => {
    const onAcross = vi.fn();
    setup({ onAcross });
    const group = screen.getByTestId('bs-across');
    expect(group).toHaveAccessibleName('Cards across');
    expect(Array.from(group.querySelectorAll('[role="radio"]')).map((r) => r.textContent)).toEqual(['Auto', '1', '2', '3', '4']);
    expect(screen.getByTestId('bs-across-auto')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('bs-across-3'));
    expect(onAcross).toHaveBeenLastCalledWith('3');
  });

  it('offers no "Cards across" on a phone or without a handler; it alone keeps the gear', () => {
    setup({ phone: true, onAcross: vi.fn() });
    expect(screen.queryByTestId('bs-across')).toBeNull();
  });

  it('keeps the gear when "Cards across" is its only choice', () => {
    setup({ shortOn: false, confirmOn: false, onAcross: vi.fn(), across: '2' });
    expect(screen.getByTestId('bs-across-2')).toHaveAttribute('aria-checked', 'true');
  });

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

  it('respects shortOn and confirmOn switches and renders nothing when all settings are off', () => {
    const { rerender, container } = render(
      <BoardSettings value={COLD_BOARD_DEFAULTS} onChange={() => {}} shortOn={false} voiceOn={false} confirmOn />,
    );
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.queryByTestId('bs-face')).toBeNull();
    expect(screen.queryByTestId('bs-voice')).toBeNull();
    expect(screen.getByTestId('bs-confirm')).toBeInTheDocument();

    rerender(<BoardSettings value={COLD_BOARD_DEFAULTS} onChange={() => {}} shortOn voiceOn={false} confirmOn={false} />);
    expect(screen.getByTestId('bs-face')).toBeInTheDocument();
    expect(screen.queryByTestId('bs-confirm')).toBeNull();

    rerender(<BoardSettings value={COLD_BOARD_DEFAULTS} onChange={() => {}} shortOn={false} voiceOn={false} confirmOn={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('reflects stored light face as Short, supports phone Done button, and honours disabled', () => {
    const { rerender } = render(
      <BoardSettings value={{ ...COLD_BOARD_DEFAULTS, face: 'light', voice: 'direct' }} onChange={() => {}} voiceOn phone />,
    );
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.getByRole('radiogroup', { name: 'Open cards as' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Voice' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show “Is this right?”' })).toBeChecked();
    expect(screen.getByTestId('bs-face-short')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('bs-face-read')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('bs-voice-direct')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByTestId('bs-close'));
    expect(screen.queryByTestId('board-settings-panel')).toBeNull();

    rerender(<BoardSettings value={COLD_BOARD_DEFAULTS} onChange={() => {}} disabled />);
    expect(screen.getByTestId('board-settings-open')).toBeDisabled();
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
