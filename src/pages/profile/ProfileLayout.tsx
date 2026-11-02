import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

/** The profile area: one tab per page, so the menu and other pages can link straight to a tab. */
const ProfileLayout: React.FC = () => {
  const { t } = useTranslation();
  const tabs = [
    { to: '/profile', label: t('profile.tabDetails'), end: true },
    { to: '/profile/plan', label: t('profile.tabPlan') },
    { to: '/profile/timeline', label: t('profile.tabTimeline') },
    { to: '/profile/settings', label: t('profile.tabSettings') },
  ];
  return (
    <div className="w-full text-white">
      <nav aria-label={t('profile.tabsLabel')} className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 pt-4 sm:px-6 sm:pt-6">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isActive ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};

export default ProfileLayout;
