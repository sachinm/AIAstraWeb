/**
 * Which dashboards the person's portal shows (server docs/dashboards/11): the profile fact `portal.dashboards`, a
 * comma list of ids, chosen in the personalization wizard. Unanswered (or unreadable) means Self, Love and Career.
 * The side menu, the board tab bar and the header's Happy Hour(s) link read it through `usePortalDashboards`; a board
 * that is not chosen stays reachable by its URL, it is only left out of the menus.
 *
 * One store for every reader, so the menus change the moment the wizard saves.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { fetchFacts, type ProfileFacts } from './profileApi';
import { BOARD_LENSES, type AreaBoardId, type BoardLensId } from './selfV3Api';

export const PORTAL_FACT = 'portal.dashboards';

/** every dashboard, in menu order (the server's PORTAL_DASHBOARDS) */
export const PORTAL_DASHBOARD_IDS = ['self', 'love', 'work', 'lucky', 'dating', 'marriage', 'friends', 'allies', 'career_start', 'primary_job', 'hobby', 'business'] as const;
export type PortalDashboardId = (typeof PORTAL_DASHBOARD_IDS)[number];

/** shown to a person who has not chosen */
export const DEFAULT_PORTAL_DASHBOARDS: readonly PortalDashboardId[] = ['self', 'love', 'work'];

export const PORTAL_DASHBOARD_LABELS: Record<PortalDashboardId, string> = {
  self: 'Self',
  love: 'Love',
  work: 'Career',
  lucky: 'Lucky times',
  dating: 'Dating & romance',
  marriage: 'Marriage & partnership',
  friends: 'Friendships',
  allies: 'Professional allies',
  career_start: 'Starting out',
  primary_job: 'Your job',
  hobby: 'Craft & hobby',
  business: 'Business',
};

/** the focused dashboards: each is a lens of the Love or the Work board */
export const LENS_BOARD: Partial<Record<PortalDashboardId, AreaBoardId>> = Object.fromEntries(
  (Object.entries(BOARD_LENSES) as Array<[AreaBoardId, ReadonlyArray<{ id: BoardLensId }>]>).flatMap(([board, lenses]) => lenses.map((l) => [l.id, board])),
);

export function isFocusedDashboard(id: PortalDashboardId): boolean {
  return !!LENS_BOARD[id];
}

const BOARD_PATH: Record<'self' | 'love' | 'work' | 'lucky', string> = {
  self: '/dashboard/you',
  love: '/dashboard/love',
  work: '/dashboard/work',
  lucky: '/dashboard/lucky',
};

/** where a dashboard opens: a focused one opens its board on its lens */
export function portalHref(id: PortalDashboardId): string {
  const board = LENS_BOARD[id];
  if (board) return `${BOARD_PATH[board]}?lens=${id}`;
  return BOARD_PATH[id as keyof typeof BOARD_PATH];
}

/** the stored value as a list: known ids once each, in menu order; nothing usable gives the default */
export function parsePortalDashboards(raw: string | null | undefined): PortalDashboardId[] {
  const parts = (raw ?? '').split(',').map((p) => p.trim());
  const list = PORTAL_DASHBOARD_IDS.filter((id) => parts.includes(id));
  return list.length ? list : [...DEFAULT_PORTAL_DASHBOARDS];
}

/** the list from the profile facts (fact or default) */
export function portalDashboardsFrom(facts: ProfileFacts['facts'] | null | undefined): PortalDashboardId[] {
  return parsePortalDashboards(facts?.[PORTAL_FACT]?.value);
}

/** the stored form, for saveFacts */
export function portalFactValue(list: readonly PortalDashboardId[]): string {
  return PORTAL_DASHBOARD_IDS.filter((id) => list.includes(id)).join(',');
}

// ---------------------------------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------------------------------

let current: PortalDashboardId[] = [...DEFAULT_PORTAL_DASHBOARDS];
/** whose list `current` is (the token it was read with); null = not read */
let loadedFor: string | null = null;
let loading: string | null = null;
const listeners = new Set<() => void>();

const tokenNow = (): string | null => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  } catch {
    return null;
  }
};

function emit() {
  for (const l of listeners) l();
}

/** after the wizard saves: every menu shows the new list at once */
export function setPortalDashboards(list: readonly PortalDashboardId[]): void {
  current = parsePortalDashboards(portalFactValue(list));
  loadedFor = tokenNow();
  // a read still in flight carries the old answer: it is dropped
  loading = null;
  emit();
}

/** sign-out, and tests: back to the default, read again on next use */
export function resetPortalDashboards(): void {
  current = [...DEFAULT_PORTAL_DASHBOARDS];
  loadedFor = null;
  loading = null;
  emit();
}

/** reads the fact once per signed-in person; a failed read keeps the default */
export function loadPortalDashboards(): void {
  const t = tokenNow();
  if (!t || loadedFor === t || loading === t) return;
  loading = t;
  void fetchFacts()
    .then((res) => {
      if (loading !== t) return;
      loading = null;
      if (!res) return;
      loadedFor = t;
      const next = portalDashboardsFrom(res.facts);
      if (next.join(',') !== current.join(',')) {
        current = next;
        emit();
      }
    })
    .catch(() => {
      if (loading === t) loading = null;
    });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => current;

/** the dashboards the portal shows, in menu order */
export function usePortalDashboards(): PortalDashboardId[] {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => loadPortalDashboards(), []);
  return list;
}
