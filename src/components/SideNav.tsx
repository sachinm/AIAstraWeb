/**
 * The side rails (Sachin, 2026-11-05). There is one left rail: the personal boards (You, Love, Work) on top, and below
 * them whatever the open page adds (General Reading's conversations), so items come and go but the rail stays one.
 * A page that needs a right rail (the profile's pages) gets one the same shape. Both sit between the header and the
 * footer, edge to edge, minimize to icons, and keep the toggle on their inner border about 15 % above the footer.
 * The choice is remembered per device; phones start minimized.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Briefcase, ChevronLeft, ChevronRight, Heart, User } from 'lucide-react';
import { track } from '../lib/events';

export const SIDE_TABS = [
  { to: '/profile', label: 'You', icon: User },
  { to: '/dashboard/love', label: 'Love', icon: Heart },
  { to: '/dashboard/work', label: 'Work', icon: Briefcase },
];

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
}
const RailCtx = createContext<LeftRail | null>(null);

export function SideNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useRemembered('astra_sidenav_open', true);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <RailCtx.Provider value={{ open, setOpen, slot, setSlot }}>{children}</RailCtx.Provider>;
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
  const open = rail ? rail.open : localOpen;
  const setOpen = rail ? rail.setOpen : setLocalOpen;

  const item = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'} ${open ? '' : 'justify-center'}`;

  return (
    <aside
      aria-label="Your boards"
      data-testid="side-nav"
      data-open={open}
      className={`glass-bar relative flex h-full shrink-0 flex-col border-r border-white/10 transition-[width] duration-200 ${open ? 'w-64' : 'w-16'}`}
    >
      <nav className="shrink-0 space-y-1 p-2">
        {SIDE_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={open ? undefined : label} aria-label={label} onClick={() => track('tab_select', 'sidenav', label.toLowerCase())} className={item}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
      {/* the open page's own items (General Reading's conversations) */}
      <div ref={rail?.setSlot} data-testid="side-nav-slot" className="flex min-h-0 flex-1 flex-col border-t border-white/10 empty:border-0" />
      <RailToggle side="left" open={open} onToggle={() => setOpen(!open)} label="sidebar" />
    </aside>
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
