/**
 * The avatar's full-screen menu on a phone (server docs/dashboards/12): the navigation that replaced the side menu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import '../i18n';
import ProfileMenuSheet from './ProfileMenuSheet';
import { resetPortalDashboards, setPortalDashboards } from '../lib/portalDashboards';

const planState = vi.hoisted(() => ({ plan: null as null | Record<string, unknown> }));
vi.mock('../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: planState.plan, setPlan: vi.fn(), refreshPlan: vi.fn() }) }));
vi.mock('../lib/profileApi', () => ({ fetchFacts: vi.fn(async () => null), fetchSelfieUrl: vi.fn(async () => null) }));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

const onLogout = vi.fn();
const onOpenWizard = vi.fn();

function mount(path = '/dashboard/you') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileMenuSheet user={{ name: 'Test Person', email: 't@example.test' }} onLogout={onLogout} onOpenWizard={onOpenWizard} />
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  planState.plan = { code: 'free', exempt: false, limit: 20, used: 7, remaining: 13 };
  localStorage.setItem('token', 't');
  resetPortalDashboards();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('the full-screen menu', () => {
  it('the avatar opens a full-screen menu over the page, portalled out of the header', () => {
    const { container } = mount();
    expect(screen.queryByTestId('profile-menu-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    const sheet = screen.getByTestId('profile-menu-sheet');
    expect(sheet).toHaveAttribute('role', 'dialog');
    expect(sheet.className).toMatch(/fixed inset-0/);
    expect(container.contains(sheet)).toBe(false);
    expect(sheet).toHaveTextContent('Test Person');
  });

  it('lists the dashboards the person chose, with the side menu’s names, and navigates', () => {
    setPortalDashboards(['self', 'work', 'lucky', 'marriage']);
    mount();
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    const list = screen.getByTestId('menu-sheet-dashboards');
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['You', 'Work', 'Happy Hour(s)', 'Marriage & partnership']);
    expect(within(list).getByTestId('menu-sheet-dashboard-self')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(list).getByTestId('menu-sheet-dashboard-marriage'));
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard/love?lens=marriage');
    expect(screen.queryByTestId('profile-menu-sheet')).toBeNull();
  });

  it('holds profile, personalize, plans and usage (with the questions left), settings and sign out', () => {
    mount();
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    expect(screen.getByTestId('menu-sheet-plan-line')).toHaveTextContent('Free plan · 13 of 20 questions left this month');
    fireEvent.click(screen.getByTestId('menu-sheet-plan'));
    expect(screen.getByTestId('where')).toHaveTextContent('/profile/plan');
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    fireEvent.click(screen.getByTestId('menu-sheet-settings'));
    expect(screen.getByTestId('where')).toHaveTextContent('/profile/locale');
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    fireEvent.click(screen.getByTestId('menu-sheet-personalize'));
    expect(onOpenWizard).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    fireEvent.click(screen.getByTestId('menu-sheet-profile'));
    expect(screen.getByTestId('where')).toHaveTextContent('/profile');
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    fireEvent.click(screen.getByTestId('menu-sheet-logout'));
    expect(onLogout).toHaveBeenCalled();
  });

  it('Escape and the close button shut it and give focus back to the avatar', () => {
    mount();
    const button = screen.getByTestId('profile-menu-sheet-button');
    fireEvent.click(button);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('profile-menu-sheet')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.click(screen.getByTestId('profile-menu-sheet-close'));
    expect(screen.queryByTestId('profile-menu-sheet')).toBeNull();
  });

  it('General Reading falls back to the chat page outside the signed-in shell', () => {
    mount();
    fireEvent.click(screen.getByTestId('profile-menu-sheet-button'));
    fireEvent.click(screen.getByTestId('menu-sheet-general-reading'));
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard/chat');
  });
});
