import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, CheckCheck, Mail, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  dismissNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../lib/notificationsApi';

const POLL_MS = 60_000;

export const MESSAGES_WORD = {
  button: 'Messages from AdAstra',
  title: 'Messages from AdAstra',
  empty: 'No messages from AdAstra yet.',
};

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * `all` (the Bell) is the one inbox, with the unread count. `messages` (server docs/dashboards/12) is the same inbox
 * filtered to messages from AdAstra (category `admin_message`): no count of its own, because the server's unread count
 * covers every category, and no second poll.
 */
const NotificationBell: React.FC<{ variant?: 'all' | 'messages' }> = ({ variant = 'all' }) => {
  const messagesOnly = variant === 'messages';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUnread = useCallback(async () => {
    const count = await fetchUnreadCount();
    setUnreadCount(count);
  }, []);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications({ limit: 20 });
      if (messagesOnly) {
        setItems(res.items.filter((x) => x.category === 'admin_message'));
        return;
      }
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [messagesOnly]);

  useEffect(() => {
    if (messagesOnly) return undefined;
    void refreshUnread();
    const onFocus = () => void refreshUnread();
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshUnread();
    }, POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [refreshUnread, messagesOnly]);

  useEffect(() => {
    if (!open) return undefined;
    void loadInbox();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, loadInbox]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, readAt: nowIso } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const res = await markNotificationRead(item.id);
    if (typeof res.unreadCount === 'number') setUnreadCount(res.unreadCount);
  };

  const handleMarkAllRead = async () => {
    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: nowIso })));
    setUnreadCount(0);
    const res = await markAllNotificationsRead();
    if (res.ok) setUnreadCount(res.unreadCount);
  };

  const handleDismiss = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    if (!item.readAt) setUnreadCount((c) => Math.max(0, c - 1));
    const res = await dismissNotification(item.id);
    if (typeof res.unreadCount === 'number') setUnreadCount(res.unreadCount);
  };

  const handleActionClick = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    await handleMarkRead(item);
    if (item.actionUrl && item.actionUrl.startsWith('/') && !item.actionUrl.startsWith('//')) {
      setOpen(false);
      navigate(item.actionUrl);
    }
  };

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const ariaLabel = messagesOnly
    ? MESSAGES_WORD.button
    : unreadCount > 0
      ? t('notifications.bellUnread', { count: unreadCount })
      : t('notifications.bellEmpty');
  const Icon = messagesOnly ? Mail : Bell;

  return (
    <div ref={rootRef} className="relative shrink-0" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={messagesOnly ? 'header-messages-button' : 'notification-bell-button'}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-300 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 md:h-10 md:w-10"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {!messagesOnly && unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0b0a1f]"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={messagesOnly ? MESSAGES_WORD.title : t('notifications.title')}
          data-testid={messagesOnly ? 'messages-popover' : 'notification-popover'}
          // a phone: fixed under the header with side insets, so an icon further left never pushes it off screen
          className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-xl border border-white/15 bg-slate-900 shadow-2xl backdrop-blur-md md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-96"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">{messagesOnly ? MESSAGES_WORD.title : t('notifications.title')}</h2>
              {!messagesOnly && unreadCount > 0 && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-200">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="notifications-mark-all-read"
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-purple-300 hover:bg-white/10 hover:text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-[65vh] divide-y divide-white/10 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">{t('notifications.loading')}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400" data-testid="notifications-empty">
                {messagesOnly ? MESSAGES_WORD.empty : t('notifications.empty')}
              </p>
            ) : (
              items.map((item) => {
                const isUnread = !item.readAt;
                const isImportant = item.priority === 'important';
                return (
                  <div
                    key={item.id}
                    data-testid={`notification-item-${item.id}`}
                    onClick={() => void handleMarkRead(item)}
                    className={`group relative cursor-pointer px-4 py-3 transition-colors hover:bg-white/5 ${
                      isUnread ? 'bg-purple-500/[0.07]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isUnread && (
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isImportant ? 'bg-amber-400' : 'bg-purple-400'
                            }`}
                            aria-label="Unread"
                          />
                        )}
                        <span className="truncate text-[11px] font-medium text-purple-300/90">
                          {item.senderLabel || t('notifications.defaultSender')}
                        </span>
                        {isImportant && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            {t('notifications.important')}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] text-gray-400">{formatRelativeTime(item.createdAt)}</span>
                        <button
                          type="button"
                          aria-label={t('notifications.dismiss')}
                          data-testid={`notification-dismiss-${item.id}`}
                          onClick={(e) => void handleDismiss(e, item)}
                          className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className={`mt-1 text-sm ${isUnread ? 'font-semibold text-white' : 'font-medium text-gray-200'}`}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-gray-300">{item.body}</p>
                    {item.actionUrl && (
                      <button
                        type="button"
                        onClick={(e) => void handleActionClick(e, item)}
                        className="mt-2 inline-flex items-center text-xs font-medium text-purple-300 hover:text-purple-200 hover:underline focus:outline-none"
                      >
                        {item.actionLabel || t('notifications.viewAction')} →
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
