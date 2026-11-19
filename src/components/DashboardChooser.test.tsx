/** The dashboards chooser (server docs/dashboards/13 §4.3): the wizard's tick list and the rail's sheet. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { DashboardChooserSheet } from './DashboardChooser';
import { resetPortalDashboards, setPortalDashboards, usePortalDashboards } from '../lib/portalDashboards';

const saved = vi.hoisted(() => ({ calls: [] as Array<Record<string, string | null>>, ok: true as boolean | 'throw' }));
vi.mock('../lib/profileApi', () => ({
  fetchFacts: vi.fn(async () => null),
  saveFacts: vi.fn(async (facts: Record<string, string | null>) => {
    saved.calls.push(facts);
    if (saved.ok === 'throw') throw new Error('offline');
    return saved.ok;
  }),
}));

const ticked = () => screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked).map((c) => c.closest('label')!.textContent);

beforeEach(() => {
  saved.calls = [];
  saved.ok = true;
  resetPortalDashboards();
});
afterEach(() => {
  cleanup();
  resetPortalDashboards();
});

describe('the Choose dashboards sheet', () => {
  it('is a labelled dialog that starts from the person’s list; Show all ticks all twelve and Save writes them', async () => {
    setPortalDashboards(['love', 'friends']);
    const onClose = vi.fn();
    render(<DashboardChooserSheet initial={['love', 'friends']} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose dashboards' });
    expect(ticked()).toEqual(['Love', 'Friendships']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show all' }));
    expect(ticked()).toHaveLength(12);
    expect(within(dialog).getByRole('button', { name: 'Show all' })).toBeDisabled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    });
    expect(saved.calls).toEqual([{ 'portal.dashboards': 'self,love,work,lucky,dating,marriage,friends,allies,career_start,primary_job,hobby,business' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(renderHook(() => usePortalDashboards()).result.current).toHaveLength(12);
  });

  it('cannot be emptied: the last tick is locked and says so', () => {
    render(<DashboardChooserSheet initial={['work', 'hobby']} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Career' }));
    expect(ticked()).toEqual(['Craft & hobby']);
    expect(screen.getByRole('checkbox', { name: 'Craft & hobby' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Craft & hobby' }));
    expect(ticked()).toEqual(['Craft & hobby']);
    expect(screen.getByText('Keep at least one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('Cancel discards the changes and saves nothing', () => {
    setPortalDashboards(['self', 'love']);
    const onClose = vi.fn();
    render(<DashboardChooserSheet initial={['self', 'love']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(saved.calls).toEqual([]);
    expect(renderHook(() => usePortalDashboards()).result.current).toEqual(['self', 'love']);
  });

  it('a failed save says so and stays open with the choice kept', async () => {
    for (const how of [false, 'throw'] as const) {
      saved.ok = how;
      setPortalDashboards(['self']);
      const onClose = vi.fn();
      const view = render(<DashboardChooserSheet initial={['self']} onClose={onClose} />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Love' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });
      expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
      expect(onClose).not.toHaveBeenCalled();
      expect(ticked()).toEqual(['Self', 'Love']);
      expect(renderHook(() => usePortalDashboards()).result.current).toEqual(['self']);
      view.unmount();
    }
  });
});
