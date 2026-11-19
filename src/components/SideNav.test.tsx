/**
 * The grouped rail (server docs/dashboards/13 §4.3): every dashboard the person chose, grouped under its board, then
 * "Choose dashboards", which opens the chooser sheet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SideNav, { SideNavProvider } from './SideNav';
import { resetPortalDashboards, setPortalDashboards } from '../lib/portalDashboards';

const saved = vi.hoisted(() => ({ calls: [] as Array<Record<string, string | null>>, ok: true }));
vi.mock('../lib/profileApi', () => ({
  fetchFacts: vi.fn(async () => null),
  saveFacts: vi.fn(async (facts: Record<string, string | null>) => {
    saved.calls.push(facts);
    return saved.ok;
  }),
}));

function mount(path = '/dashboard/you') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideNavProvider>
        <SideNav />
      </SideNavProvider>
    </MemoryRouter>,
  );
}

const entries = () => [...within(screen.getByTestId('side-nav-boards')).queryAllByRole('link')].map((a) => a.getAttribute('aria-label'));

beforeEach(() => {
  saved.calls = [];
  saved.ok = true;
  localStorage.setItem('astra_sidenav_open', '1');
  resetPortalDashboards();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  resetPortalDashboards();
});

describe('the grouped rail', () => {
  it('with no stored list shows all twelve, grouped under their boards, then Choose dashboards', () => {
    mount();
    expect(entries()).toEqual([
      'You',
      'Love',
      'Dating & romance',
      'Marriage & partnership',
      'Friendships',
      'Professional allies',
      'Work',
      'Starting out',
      'Your job',
      'Craft & hobby',
      'Business',
      'Happy Hour(s)',
    ]);
    expect(within(screen.getByTestId('side-nav-group-love')).getByTestId('side-nav-focused-dating')).toBeInTheDocument();
    expect(within(screen.getByTestId('side-nav-group-work')).getByTestId('side-nav-focused-business')).toBeInTheDocument();
    // Happy Hour(s) is in the rail from 768 px now, not only the drawer
    expect(screen.getByTestId('drawer-happy-hours').className).not.toMatch(/md:hidden/);
    expect(screen.getByTestId('side-nav-choose')).toHaveTextContent('Choose dashboards');
  });

  it('a stored list of four shows those four plus Choose dashboards; a lens without its board sits under a plain label', () => {
    setPortalDashboards(['self', 'work', 'lucky', 'marriage']);
    mount();
    expect(entries()).toEqual(['You', 'Marriage & partnership', 'Work', 'Happy Hour(s)']);
    const label = screen.getByTestId('side-nav-label-love');
    expect(label.tagName).not.toBe('A');
    expect(label).toHaveTextContent('Love');
    expect(screen.getByTestId('side-nav-choose')).toBeInTheDocument();
  });

  it('minimized, every entry is an icon with a tooltip', () => {
    localStorage.setItem('astra_sidenav_open', '0');
    mount();
    expect(screen.getByTestId('side-nav')).toHaveAttribute('data-open', 'false');
    for (const a of within(screen.getByTestId('side-nav-boards')).getAllByRole('link')) {
      expect(a.getAttribute('title')).toBe(a.getAttribute('aria-label'));
      expect(a.textContent).toBe('');
    }
    expect(screen.getByTestId('side-nav-choose')).toHaveAttribute('title', 'Choose dashboards');
  });

  it('a focused entry is the active one on its lens, and its board link is not marked for another lens', () => {
    mount('/dashboard/work?lens=hobby');
    expect(screen.getByTestId('side-nav-focused-hobby').className).toMatch(/bg-white\/15/);
    expect(screen.getByTestId('side-nav-focused-business').className).not.toMatch(/bg-white\/15/);
    expect(screen.getByTestId('side-nav-focused-dating').className).not.toMatch(/bg-white\/15/);
  });

  it('Choose dashboards opens the chooser; Show all then Save stores twelve and the rail follows', async () => {
    setPortalDashboards(['self', 'love', 'work', 'lucky']);
    mount();
    expect(entries()).toHaveLength(4);
    const button = screen.getByTestId('side-nav-choose');
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Choose dashboards' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show all' }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saved.calls).toEqual([{ 'portal.dashboards': 'self,love,work,lucky,dating,marriage,friends,allies,career_start,primary_job,hobby,business' }]);
    expect(entries()).toHaveLength(12);
    expect(document.activeElement).toBe(button);
  });

  it('Esc closes the chooser without saving and gives focus back to the button', () => {
    mount();
    const button = screen.getByTestId('side-nav-choose');
    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saved.calls).toEqual([]);
    expect(document.activeElement).toBe(button);
  });
});
