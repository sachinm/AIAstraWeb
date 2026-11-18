/**
 * The side rails (Sachin, 2026-11-05). There is one left rail: the personal boards (You, Love, Work) on top, and below
 * them whatever the open page adds (General Reading's conversations), so items come and go but the rail stays one.
 * A page that needs a right rail (the profile's pages) gets one the same shape. Both sit between the header and the
 * footer, edge to edge, minimize to icons, and keep the toggle on their inner border about 15 % above the footer.
 * The choice is remembered per device; phones start minimized.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Briefcase, Building2, ChevronLeft, ChevronRight, Clock, Gem, Handshake, Heart, Palette, Sparkles, Sprout, Store, User, Users, X, type LucideIcon } from 'lucide-react';
import { track } from '../lib/events';
import { PORTAL_DASHBOARD_LABELS, isFocusedDashboard, portalHref, usePortalDashboards, type PortalDashboardId } from '../lib/portalDashboards';

/** the three boards; each shows only when the person's portal list has it (server docs/dashboards/11) */
export const SIDE_TABS: Array<{ id: PortalDashboardId; to: string; label: string; icon: LucideIcon }> = [
  { id: 'self', to: '/dashboard/you', label: 'You', icon: User },
  { id: 'love', to: '/dashboard/love', label: 'Love', icon: Heart },
  { id: 'work', to: '/dashboard/work', label: 'Work', icon: Briefcase },
];
/** in the header from 768 px; below that, in the drawer only; shown when the portal list has Lucky times */
const DRAWER_EXTRA_TABS: Array<{ id: PortalDashboardId; to: string; label: string; icon: LucideIcon }> = [{ id: 'lucky', to: '/dashboard/lucky', label: 'Happy Hour(s)', icon: Clock }];

/** the focused dashboards' icons (each opens the Love or Work board on its lens) */
export const FOCUSED_ICONS: Partial<Record<PortalDashboardId, LucideIcon>> = {
  dating: Sparkles,
  marriage: Gem,
  friends: Users,
  allies: Handshake,
  career_start: Sprout,
  primary_job: Building2,
  hobby: Palette,
  business: Store,
};

/** the focused dashboards the person chose, as menu entries, in menu order */
export function focusedEntries(list: readonly PortalDashboardId[]): Array<{ id: PortalDashboardId; to: string; label: string; icon: LucideIcon }> {
  return list.filter(isFocusedDashboard).map((id) => ({ id, to: portalHref(id), label: PORTAL_DASHBOARD_LABELS[id], icon: FOCUSED_ICONS[id] ?? Sparkles }));
}

/** a focused entry is the open page when its board is open on its lens (from the link; NavLink matches the path only) */
export function focusedActive(to: string, pathname: string, search: string): boolean {
  const [path, query = ''] = to.split('?');
  const want = new URLSearchParams(query).get('lens');
  return pathname.replace(/\/+$/, '') === path && !!want && new URLSearchParams(search).get('lens') === want;
}

function remembered(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v === '1';
  } catch {
    // storage blocked
  }
  return typeof window === 'undefined' ? fallback : fallback && window.innerWidth >= 1024;
}

function useRemembered(key: string, fallback: boolean) {
  const [open, setOpen] = useState(() => remembered(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, open ? '1' : '0');
    } catch {
      // storage blocked
    }
  }, [key, open]);
  return [open, setOpen] as const;
}

/** The left rail's state and the spot where a page adds its own items. Null outside the signed-in shell, and inside General Reading's modal. */
interface LeftRail {
  open: boolean;
  setOpen: (open: boolean) => void;
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  /** below 768 px the rail is hidden and slides in as a drawer from the header's menu button (Sachin, 2026-11-10) */
  drawer: boolean;
  setDrawer: (open: boolean) => void;
}
const RailCtx = createContext<LeftRail | null>(null);

export function SideNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useRemembered('astra_sidenav_open', true);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [drawer, setDrawer] = useState(false);
  return <RailCtx.Provider value={{ open, setOpen, slot, setSlot, drawer, setDrawer }}>{children}</RailCtx.Provider>;
}

/** For a page that adds items to the left rail: where to portal them, and whether the rail is open. */
export function useLeftRail(): LeftRail | null {
  return useContext(RailCtx);
}

/** Hides the left rail from what it wraps (General Reading's modal keeps its own conversation list). */
export function NoLeftRail({ children }: { children: ReactNode }) {
  return <RailCtx.Provider value={null}>{children}</RailCtx.Provider>;
}

function RailToggle({ side, open, onToggle, label }: { side: 'left' | 'right'; open: boolean; onToggle: () => void; label: string }) {
  const Out = side === 'left' ? ChevronRight : ChevronLeft;
  const In = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? `Minimize the ${label}` : `Open the ${label}`}
      aria-expanded={open}
      data-testid={side === 'left' ? 'side-nav-toggle' : 'right-rail-toggle'}
      className={`absolute bottom-[15%] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#141233] text-white/70 shadow-md hover:text-white ${side === 'left' ? '-right-3.5' : '-left-3.5'}`}
    >
      {open ? <In className="h-4 w-4" aria-hidden="true" /> : <Out className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

export default function SideNav() {
  const rail = useLeftRail();
  const [localOpen, setLocalOpen] = useState(true);
  const drawer = rail?.drawer ?? false;
  const setDrawer = rail?.setDrawer;
  // in the phone drawer the labels always show
  const open = drawer || (rail ? rail.open : localOpen);
  const setOpen = rail ? rail.setOpen : setLocalOpen;
  const { pathname, search } = useLocation();
  const portal = usePortalDashboards();
  const mainTabs = SIDE_TABS.filter((t) => portal.includes(t.id));
  const focused = focusedEntries(portal);
  const extraTabs = DRAWER_EXTRA_TABS.filter((t) => portal.includes(t.id));

  // a move to another page closes the drawer
  useEffect(() => {
    setDrawer?.(false);
  }, [pathname, setDrawer]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer?.(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, setDrawer]);

  const item = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[40px] items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'} ${open ? '' : 'justify-center'}`;

  return (
    <>
      {/* below 768 px the rail is a drawer over the page, behind a tap-to-close shade; from 768 px it is the rail */}
      {drawer && <div className="fixed inset-0 z-[55] bg-black/60 md:hidden" onClick={() => setDrawer?.(false)} aria-hidden="true" data-testid="side-nav-shade" />}
      <aside
        id="side-nav"
        aria-label="Your boards"
        data-testid="side-nav"
        data-open={open}
        data-drawer={drawer}
        className={`glass-bar flex shrink-0 flex-col border-r border-white/10 transition-[width,transform] duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[60] max-md:w-64 max-md:!bg-[#0d0c24] md:relative md:h-full ${drawer ? 'max-md:translate-x-0' : 'max-md:-translate-x-full max-md:invisible'} ${open ? 'md:w-40' : 'md:w-14'}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-white/10 px-2 md:hidden">
          <button type="button" onClick={() => setDrawer?.(false)} aria-label="Close the menu" data-testid="side-nav-close" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {/* up to twelve entries: the list scrolls inside the rail, never the page */}
        <nav className="min-h-0 space-y-1 overflow-y-auto p-1.5" data-testid="side-nav-boards">
          {mainTabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={open ? undefined : label} aria-label={label} onClick={() => track('tab_select', 'sidenav', label.toLowerCase())} className={item}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {open && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
          {focused.map(({ id, to, label, icon: Icon }) => (
            <NavLink
              key={id}
              to={to}
              end
              title={open ? undefined : label}
              aria-label={label}
              data-testid={`side-nav-focused-${id}`}
              onClick={() => track('tab_select', 'sidenav', id)}
              className={() => item({ isActive: focusedActive(to, pathname, search) })}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {open && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
          {extraTabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} aria-label={label} data-testid="drawer-happy-hours" onClick={() => track('tab_select', 'drawer', label.toLowerCase())} className={(s) => `${item(s)} md:hidden`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
        {/* the open page's own items (General Reading's conversations) */}
        <div ref={rail?.setSlot} data-testid="side-nav-slot" className="flex min-h-0 flex-1 flex-col border-t border-white/10 empty:border-0 [&:not(:empty)]:min-h-[40%]" />
        <div className="max-md:hidden">
          <RailToggle side="left" open={open} onToggle={() => setOpen(!open)} label="sidebar" />
        </div>
      </aside>
    </>
  );
}

/**
 * A right rail anchored to the right edge between the header and the footer, for pages that need one (the profile's
 * pages). It minimizes to its icons; `children` gets whether it is open.
 */
export function RightSidebar({ children, label, storageKey = 'astra_rightrail_open' }: { children: (open: boolean) => ReactNode; label: string; storageKey?: string }) {
  const [open, setOpen] = useRemembered(storageKey, true);
  return (
    <aside
      aria-label={label}
      data-testid="right-rail"
      data-open={open}
      className={`glass-bar relative flex h-full shrink-0 flex-col border-l border-white/10 transition-[width] duration-200 ${open ? 'w-64' : 'w-16'}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children(open)}</div>
      <RailToggle side="right" open={open} onToggle={() => setOpen(!open)} label={label.toLowerCase()} />
    </aside>
  );
}
