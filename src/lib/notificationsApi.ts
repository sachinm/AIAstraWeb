import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export type NotificationCategory = 'admin_message' | 'system' | 'reading' | 'billing';
export type NotificationPriority = 'normal' | 'important';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  senderLabel: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  actionLabel: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

export async function fetchUnreadCount(): Promise<number> {
  const t = token();
  if (!t) return 0;
  try {
    const headers = await buildApiHeaders({ token: t, method: 'GET' });
    const r = await fetch(ledgerApiUrl('/api/notifications/unread-count'), { method: 'GET', headers });
    if (!r.ok) return 0;
    const data = (await r.json()) as { unreadCount?: number };
    return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
  } catch {
    return 0;
  }
}

export async function fetchNotifications(options: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationsResponse> {
  const t = token();
  if (!t) return { items: [], unreadCount: 0 };
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.unreadOnly) params.set('unreadOnly', '1');
  const qs = params.toString();
  const headers = await buildApiHeaders({ token: t, method: 'GET' });
  const r = await fetch(ledgerApiUrl(`/api/notifications${qs ? `?${qs}` : ''}`), { method: 'GET', headers });
  if (!r.ok) return { items: [], unreadCount: 0 };
  const data = (await r.json()) as Partial<NotificationsResponse>;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
  };
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean; unreadCount?: number }> {
  const t = token();
  if (!t) return { ok: false };
  const headers = await buildApiHeaders({ token: t, method: 'PATCH' });
  const r = await fetch(ledgerApiUrl(`/api/notifications/${encodeURIComponent(id)}/read`), { method: 'PATCH', headers });
  if (!r.ok) return { ok: false };
  const data = (await r.json()) as { unreadCount?: number };
  return { ok: true, unreadCount: data.unreadCount };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; unreadCount: number }> {
  const t = token();
  if (!t) return { ok: false, unreadCount: 0 };
  const body = '{}';
  const headers = await buildApiHeaders({ token: t, body, method: 'POST' });
  const r = await fetch(ledgerApiUrl('/api/notifications/read-all'), { method: 'POST', headers, body });
  if (!r.ok) return { ok: false, unreadCount: 0 };
  const data = (await r.json()) as { unreadCount?: number };
  return { ok: true, unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0 };
}

export async function dismissNotification(id: string): Promise<{ ok: boolean; unreadCount?: number }> {
  const t = token();
  if (!t) return { ok: false };
  const headers = await buildApiHeaders({ token: t, method: 'DELETE' });
  const r = await fetch(ledgerApiUrl(`/api/notifications/${encodeURIComponent(id)}`), { method: 'DELETE', headers });
  if (!r.ok) return { ok: false };
  const data = (await r.json()) as { unreadCount?: number };
  return { ok: true, unreadCount: data.unreadCount };
}
