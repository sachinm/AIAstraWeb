/**
 * The boards' tab bar (server docs/reading-engine/45 §4): Today · You · Love · Work · Ask, at the bottom of every
 * dashboard page except the chat (which keeps its own input there). Shown only with VITE_BOARDS_ENABLED=1.
 */
import { NavLink } from 'react-router-dom';
import { Briefcase, Heart, MessageCircle, Sun, User } from 'lucide-react';
import { track } from '../lib/events';
import { usePortalDashboards, type PortalDashboardId } from '../lib/portalDashboards';

/** Today and Ask always; You, Love and Work only when the person's portal list has them (server docs/dashboards/11).
 * The focused dashboards live in the side menu, not here: the bar keeps one row of large targets. */
const TABS: Array<{ to: string; label: string; icon: typeof Sun; id?: PortalDashboardId }> = [
  { to: '/dashboard/today', label: 'Today', icon: Sun },
  { id: 'self', to: '/dashboard/you', label: 'You', icon: User },
  { id: 'love', to: '/dashboard/love', label: 'Love', icon: Heart },
  { id: 'work', to: '/dashboard/work', label: 'Work', icon: Briefcase },
  { to: '/dashboard/chat', label: 'Ask', icon: MessageCircle },
];

export function boardsEnabled(): boolean {
  return import.meta.env.VITE_BOARDS_ENABLED === '1';
}

export default function BoardTabBar() {
  const portal = usePortalDashboards();
  const tabs = TABS.filter((t) => !t.id || portal.includes(t.id));
  return (
    <nav aria-label="Boards" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0a1f]/95 backdrop-blur-md" data-testid="board-tabbar">
      <ul className="mx-auto flex max-w-xl justify-between px-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              onClick={() => track('tab_select', 'tabbar', label.toLowerCase())}
              className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'text-white' : 'text-white/55'}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
