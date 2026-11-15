import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../i18n';
import NotificationBell from './NotificationBell';
import * as api from '../lib/notificationsApi';

vi.mock('../lib/notificationsApi', () => ({
  fetchUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  dismissNotification: vi.fn(),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unread badge capped at 9+ and opens popover with messages', async () => {
    vi.mocked(api.fetchUnreadCount).mockResolvedValue(12);
    vi.mocked(api.fetchNotifications).mockResolvedValue({
      unreadCount: 1,
      items: [
        {
          id: 'n1',
          category: 'admin_message',
          priority: 'important',
          senderLabel: 'AI AdAstra Team',
          title: 'Your annual chart is ready',
          body: 'We refreshed your 2026 Tithi Pravesha reading.',
          actionUrl: '/dashboard/you',
          actionLabel: 'View reading',
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(api.markNotificationRead).mockResolvedValue({ ok: true, unreadCount: 0 });
    vi.mocked(api.dismissNotification).mockResolvedValue({ ok: true, unreadCount: 0 });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('9+');
    });

    await user.click(screen.getByTestId('notification-bell-button'));
    await waitFor(() => {
      expect(screen.getByTestId('notification-popover')).toBeInTheDocument();
      expect(screen.getByText('Your annual chart is ready')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('notification-item-n1'));
    await waitFor(() => {
      expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
      expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('notification-dismiss-n1'));
    await waitFor(() => {
      expect(api.dismissNotification).toHaveBeenCalledWith('n1');
      expect(screen.getByTestId('notifications-empty')).toBeInTheDocument();
    });
  });

  it('supports mark all read', async () => {
    vi.mocked(api.fetchUnreadCount).mockResolvedValue(2);
    vi.mocked(api.fetchNotifications).mockResolvedValue({
      unreadCount: 2,
      items: [
        {
          id: 'n1',
          category: 'admin_message',
          priority: 'normal',
          senderLabel: 'AI AdAstra',
          title: 'Notice 1',
          body: 'Body 1',
          actionUrl: null,
          actionLabel: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'n2',
          category: 'system',
          priority: 'normal',
          senderLabel: 'AI AdAstra',
          title: 'Notice 2',
          body: 'Body 2',
          actionUrl: null,
          actionLabel: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ ok: true, unreadCount: 0 });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('notification-bell-button'));
    await waitFor(() => {
      expect(screen.getByTestId('notifications-mark-all-read')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('notifications-mark-all-read'));
    await waitFor(() => {
      expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
    });
  });
});
