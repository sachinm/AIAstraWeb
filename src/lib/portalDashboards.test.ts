/** The portal's dashboards (server docs/dashboards/11): the fact or the default, labels, links and the shared store. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  DEFAULT_PORTAL_DASHBOARDS,
  LENS_BOARD,
  PORTAL_DASHBOARD_IDS,
  PORTAL_DASHBOARD_LABELS,
  parsePortalDashboards,
  portalDashboardsFrom,
  portalFactValue,
  portalHref,
  resetPortalDashboards,
  setPortalDashboards,
  usePortalDashboards,
} from './portalDashboards';

const factsBody = (value: string) => JSON.stringify({ facts: { 'portal.dashboards': { value, source: 'tapped', confirmed_at: '2026-11-18T00:00:00Z' } }, wizard: { done: null, skipped: null } });

beforeEach(() => resetPortalDashboards());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  resetPortalDashboards();
});

describe('the portal list', () => {
  it('defaults to all twelve when unanswered, declined or unreadable (server docs/dashboards/13, decision 1)', () => {
    expect(DEFAULT_PORTAL_DASHBOARDS).toEqual([...PORTAL_DASHBOARD_IDS]);
    expect(portalDashboardsFrom(null)).toEqual([...PORTAL_DASHBOARD_IDS]);
    expect(portalDashboardsFrom({})).toEqual([...PORTAL_DASHBOARD_IDS]);
    expect(parsePortalDashboards('declined')).toEqual([...PORTAL_DASHBOARD_IDS]);
    expect(parsePortalDashboards('horoscope, ,')).toEqual([...PORTAL_DASHBOARD_IDS]);
    // a stored list is kept exactly as it is: the old default of four stays four
    expect(parsePortalDashboards('self,love,work')).toEqual(['self', 'love', 'work']);
    expect(parsePortalDashboards('self,love,work,lucky')).toEqual(['self', 'love', 'work', 'lucky']);
  });
  it('keeps known ids once each, in menu order', () => {
    expect(parsePortalDashboards('business, lucky,self,business,horoscope')).toEqual(['self', 'lucky', 'business']);
    expect(portalFactValue(['dating', 'work', 'dating'])).toBe('work,dating');
  });
  it('has a label for every dashboard and the spec words', () => {
    expect(PORTAL_DASHBOARD_IDS.map((id) => PORTAL_DASHBOARD_LABELS[id])).toEqual([
      'Self',
      'Love',
      'Career',
      'Lucky times',
      'Dating & romance',
      'Marriage & partnership',
      'Friendships',
      'Professional allies',
      'Starting out',
      'Your job',
      'Craft & hobby',
      'Business',
    ]);
  });
  it('links the boards to their pages and the focused dashboards to their board on their lens', () => {
    expect(portalHref('self')).toBe('/dashboard/you');
    expect(portalHref('work')).toBe('/dashboard/work');
    expect(portalHref('lucky')).toBe('/dashboard/lucky');
    expect(portalHref('allies')).toBe('/dashboard/love?lens=allies');
    expect(portalHref('career_start')).toBe('/dashboard/work?lens=career_start');
    expect(Object.keys(LENS_BOARD).sort()).toEqual(['allies', 'business', 'career_start', 'dating', 'friends', 'hobby', 'marriage', 'primary_job']);
  });
});

describe('the store', () => {
  it('reads the fact once for a signed-in person and every reader follows a save at once', async () => {
    localStorage.setItem('token', 't');
    const fetchMock = vi.fn(async () => new Response(factsBody('love,lucky'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = renderHook(() => usePortalDashboards());
    const b = renderHook(() => usePortalDashboards());
    expect(a.result.current).toEqual([...PORTAL_DASHBOARD_IDS]);
    await waitFor(() => expect(a.result.current).toEqual(['love', 'lucky']));
    expect(b.result.current).toEqual(['love', 'lucky']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => setPortalDashboards(['work', 'hobby']));
    expect(a.result.current).toEqual(['work', 'hobby']);
    expect(b.result.current).toEqual(['work', 'hobby']);
  });
  it('does not read without a session, and keeps the default when the read fails', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = renderHook(() => usePortalDashboards());
    expect(fetchMock).not.toHaveBeenCalled();
    localStorage.setItem('token', 't');
    const b = renderHook(() => usePortalDashboards());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(a.result.current).toEqual([...PORTAL_DASHBOARD_IDS]);
    expect(b.result.current).toEqual([...PORTAL_DASHBOARD_IDS]);
  });
});
