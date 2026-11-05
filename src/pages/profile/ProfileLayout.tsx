import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { CreditCard, Globe, History, Scale, UserRound } from 'lucide-react';
import { RightSidebar } from '../../components/SideNav';

/**
 * The profile area: one page per tab, so the menu and other pages can link straight to a tab. The tabs sit in a right
 * rail that minimizes to icons, and the page takes the whole main area (Sachin, 2026-11-05).
 */
const ProfileLayout: React.FC = () => {
  const { t } = useTranslation();
  const tabs = [
    { to: '/profile', label: t('profile.tabDetails'), icon: UserRound, end: true },
    { to: '/profile/plan', label: t('profile.tabPlan'), icon: CreditCard },
    { to: '/profile/timeline', label: t('profile.tabTimeline'), icon: History },
    { to: '/profile/locale', label: t('profile.tabLocale'), icon: Globe },
    { to: '/profile/legal', label: t('profile.tabLegal'), icon: Scale },
  ];
  return (
    <div className="flex min-h-0 w-full flex-1 text-white">
      <div className="profile-page min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <RightSidebar label={t('profile.tabsLabel')} storageKey="astra_profile_rail_open">
        {(open) => (
          <nav aria-label={t('profile.tabsLabel')} className="space-y-1">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={open ? undefined : label}
                aria-label={label}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 ${open ? '' : 'justify-center'} ${
                    isActive ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {open && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </nav>
        )}
      </RightSidebar>
    </div>
  );
};

export default ProfileLayout;
