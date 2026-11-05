/**
 * The header's navigation (Sachin, 2026-11-05): Happy Hour(s) (the home) and General Reading, which opens over
 * the page as a 98 % modal. The personal boards (You, Love, Work) live in the left sidebar. On a phone the labels drop
 * and the icons stay.
 */
import { NavLink } from 'react-router-dom';
import { Clock, MessageCircle } from 'lucide-react';
import { track } from '../lib/events';
import { useGeneralReading } from './GeneralReading';

export const HEADER_TABS = [
  { to: '/dashboard/lucky', label: 'Happy Hour(s)', icon: Clock },
];

export default function HeaderTabs() {
  const openGeneralReading = useGeneralReading();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm ${isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`;
  return (
    <nav aria-label="Main" className="min-w-0 shrink-0" data-testid="header-tabs">
      <ul className="flex items-center justify-start gap-1 overflow-x-auto">
        {HEADER_TABS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} onClick={() => track('tab_select', 'header', label.toLowerCase())} className={tab} aria-label={label}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={openGeneralReading}
            aria-label="General Reading"
            data-testid="general-reading-link"
            className="ml-1 flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white/85 hover:bg-white/10"
          >
            <MessageCircle className="h-4 w-4 text-purple-300" aria-hidden="true" />
            <span className="hidden sm:inline">General Reading</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
