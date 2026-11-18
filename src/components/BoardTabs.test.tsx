import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BoardTabBar from './BoardTabBar';
import SideNav, { SIDE_TABS, SideNavProvider, focusedActive, useLeftRail } from './SideNav';
import { resetPortalDashboards, setPortalDashboards } from '../lib/portalDashboards';

afterEach(() => resetPortalDashboards());

describe('board tabs (server docs/reading-engine/45 §4, 54 §3)', () => {
  it('You is the first board in the side rail and opens the You board', () => {
    expect(SIDE_TABS.map((t) => t.label)).toEqual(['You', 'Love', 'Work']);
    render(
      <MemoryRouter initialEntries={['/dashboard/you']}>
        <SideNav />
      </MemoryRouter>,
    );
    const you = screen.getByRole('link', { name: 'You' });
    expect(you).toHaveAttribute('href', '/dashboard/you');
    expect(screen.getByRole('link', { name: 'Love' })).toHaveAttribute('href', '/dashboard/love');
    // Lucky times is not in the default portal list (server docs/dashboards/11)
    expect(screen.queryByRole('link', { name: 'Happy Hour(s)' })).toBeNull();
    act(() => setPortalDashboards(['self', 'love', 'work', 'lucky']));
    const happy = screen.getByRole('link', { name: 'Happy Hour(s)' });
    expect(happy).toHaveAttribute('href', '/dashboard/lucky');
    expect(happy).toHaveClass('md:hidden');
  });
  it('the side rail shows only the chosen dashboards; focused ones open their board on their lens', () => {
    setPortalDashboards(['love', 'dating', 'business']);
    render(
      <MemoryRouter initialEntries={['/dashboard/love?lens=dating']}>
        <SideNav />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').map((l) => [l.getAttribute('aria-label'), l.getAttribute('href')])).toEqual([
      ['Love', '/dashboard/love'],
      ['Dating & romance', '/dashboard/love?lens=dating'],
      ['Business', '/dashboard/work?lens=business'],
    ]);
    expect(screen.getByTestId('side-nav-focused-dating').className).toContain('bg-white/15');
    expect(screen.getByTestId('side-nav-focused-business').className).not.toContain('bg-white/15');
  });
  it('a focused entry on the board already open closes the phone drawer', () => {
    setPortalDashboards(['love', 'marriage']);
    const OpenDrawer = () => {
      const rail = useLeftRail();
      useEffect(() => rail?.setDrawer(true), []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    };
    render(
      <MemoryRouter initialEntries={['/dashboard/love']}>
        <SideNavProvider>
          <SideNav />
          {/* after SideNav: its first-render "page changed" close runs first */}
          <OpenDrawer />
        </SideNavProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('side-nav')).toHaveAttribute('data-drawer', 'true');
    fireEvent.click(screen.getByTestId('side-nav-focused-marriage'));
    expect(screen.getByTestId('side-nav')).toHaveAttribute('data-drawer', 'false');
  });
    it('a focused entry is active only on its own lens', () => {
    expect(focusedActive('/dashboard/love?lens=dating', '/dashboard/love', '?lens=dating')).toBe(true);
    expect(focusedActive('/dashboard/love?lens=dating', '/dashboard/love', '?lens=marriage')).toBe(false);
    expect(focusedActive('/dashboard/love?lens=dating', '/dashboard/love', '')).toBe(false);
    expect(focusedActive('/dashboard/love?lens=dating', '/dashboard/work', '?lens=dating')).toBe(false);
  });
  it('the bottom tab bar has You before Love and Work', () => {
    render(
      <MemoryRouter>
        <BoardTabBar />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')]);
    expect(links.slice(1, 4)).toEqual([
      ['You', '/dashboard/you'],
      ['Love', '/dashboard/love'],
      ['Work', '/dashboard/work'],
    ]);
  });
  it('the bottom tab bar drops the boards the person did not choose, keeps Today and Ask', () => {
    setPortalDashboards(['work']);
    render(
      <MemoryRouter>
        <BoardTabBar />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Today', 'Work', 'Ask']);
  });
});
