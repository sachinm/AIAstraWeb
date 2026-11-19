/**
 * The app header on a phone (server docs/dashboards/12): the logo and "AdAstraAI" on the left (never clipped), the
 * board's slot (the card title) in the middle, and Messages, the Bell, the General Reading bubble with the questions
 * left, and the avatar on the right. The side-menu button is gone except on the chat page (its drawer holds the
 * conversations); the usage ring stays for tablet and desktop only. Messages is the same inbox filtered to AdAstra's own
 * messages, with no poll or count of its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n';
import TopNavigation, { PHONE_BRAND } from './TopNavigation';
import { SideNavProvider } from '../components/SideNav';
import * as api from '../lib/notificationsApi';

const planState = vi.hoisted(() => ({ plan: null as null | Record<string, unknown> }));
vi.mock('../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: planState.plan, setPlan: vi.fn(), refreshPlan: vi.fn() }) }));
vi.mock('./welcome/WelcomeWizard', () => ({ default: () => <div data-testid="wizard" /> }));
vi.mock('../components/BoardTabBar', () => ({ boardsEnabled: () => true }));
vi.mock('../lib/notificationsApi', () => ({
  fetchUnreadCount: vi.fn(async () => 3),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  dismissNotification: vi.fn(),
}));

const user = { name: 'Test Person', email: 't@example.test' };

function mount(path = '/dashboard/you') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideNavProvider>
        <TopNavigation user={user} onLogout={() => undefined} />
      </SideNavProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  planState.plan = { code: 'free', exempt: false, limit: 20, used: 7, remaining: 13, window: 'month' };
  vi.mocked(api.fetchNotifications).mockResolvedValue({
    unreadCount: 2,
    items: [
      { id: 'a', category: 'admin_message', priority: 'normal', senderLabel: 'AdAstra', title: 'A note from us', body: 'Hello.', actionUrl: null, actionLabel: null, readAt: null, createdAt: new Date().toISOString() },
      { id: 'b', category: 'reading', priority: 'normal', senderLabel: null, title: 'Your reading is ready', body: 'Open it.', actionUrl: null, actionLabel: null, readAt: null, createdAt: new Date().toISOString() },
    ],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the phone header', () => {
  it('brand on the left, the board slot in the middle, Messages · Bell · General Reading · avatar on the right', () => {
    mount();
    const row = screen.getByTestId('header-row');
    const brand = screen.getByTestId('header-brand');
    const slot = row.querySelector('[data-board-header-slot]')!;
    const actions = screen.getByTestId('header-actions');
    // DOM order is the visual order in the flex row
    const order = [brand, slot, actions].map((el) => Array.from(row.children).indexOf(el as Element));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(slot.className).toMatch(/flex-1/);
    expect(slot.className).toMatch(/justify-center/);
    // the name in full, never truncated or shrunk away
    const name = screen.getByTestId('header-brand-name');
    expect(name).toHaveTextContent(PHONE_BRAND);
    expect(PHONE_BRAND).toBe('AdAstraAI');
    expect(name.className).toMatch(/shrink-0/);
    expect(name.className).toMatch(/whitespace-nowrap/);
    expect(name.className).not.toMatch(/truncate/);
    // the four actions in order
    const ids = ['header-messages-button', 'notification-bell-button', 'header-general-reading', 'profile-menu-sheet-button'];
    const els = ids.map((id) => within(actions).getByTestId(id));
    const pos = els.map((el) => Array.from(actions.querySelectorAll('button')).indexOf(el as HTMLButtonElement));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });

  it('the questions left ride on the General Reading bubble; the ring is for tablet and desktop only', () => {
    mount();
    expect(screen.getByTestId('header-questions-left')).toHaveTextContent('13');
    expect(screen.getByTestId('header-general-reading')).toHaveAttribute('aria-label', 'General Reading, 13 questions left');
    expect(screen.getByTestId('header-usage-ring-slot').className).toMatch(/\bhidden\b.*\bmd:block\b/);
  });

  it('no count for an exempt account; a red 0 when none are left', () => {
    planState.plan = { code: 'unlimited', exempt: true, limit: null, used: 3, remaining: null };
    const { unmount } = mount();
    expect(screen.queryByTestId('header-questions-left')).toBeNull();
    unmount();
    planState.plan = { code: 'free', exempt: false, limit: 20, used: 20, remaining: 0 };
    mount();
    expect(screen.getByTestId('header-questions-left')).toHaveTextContent('0');
    expect(screen.getByTestId('header-questions-left')).toHaveAttribute('data-tone', 'red');
  });

  it('the side-menu button is gone on a board, and stays on the chat page for its conversations', () => {
    const { unmount } = mount('/dashboard/you');
    expect(screen.queryByTestId('header-menu-button')).toBeNull();
    unmount();
    mount('/dashboard/chat');
    expect(screen.getByTestId('header-menu-button')).toBeInTheDocument();
  });

  it('Messages is the same inbox filtered to AdAstra’s messages, with no poll or count of its own', async () => {
    mount();
    // one unread poll: the Bell's
    await waitFor(() => expect(api.fetchUnreadCount).toHaveBeenCalledTimes(1));
    expect(within(screen.getByTestId('header-messages-button')).queryByTestId('notification-unread-badge')).toBeNull();
    fireEvent.click(screen.getByTestId('header-messages-button'));
    const pop = await screen.findByTestId('messages-popover');
    await waitFor(() => expect(within(pop).getByText('A note from us')).toBeInTheDocument());
    expect(within(pop).queryByText('Your reading is ready')).toBeNull();
  });
});
