import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BoardTabBar from './BoardTabBar';
import SideNav, { SIDE_TABS } from './SideNav';

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
    const happy = screen.getByRole('link', { name: 'Happy Hour(s)' });
    expect(happy).toHaveAttribute('href', '/dashboard/lucky');
    expect(happy).toHaveClass('md:hidden');
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
});
