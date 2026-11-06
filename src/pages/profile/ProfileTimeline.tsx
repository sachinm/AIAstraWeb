import React from 'react';
import { useTranslation } from 'react-i18next';
import LedgerSection from '../timeline/LedgerSection';
import LifeReadingDashboard from '../timeline/LifeReadingDashboard';
import PastLifeReadingSection from '../timeline/PastLifeReadingSection';

/** The chronological life reading and the life events it draws on. */
const ProfileTimeline: React.FC = () => {
  const { t } = useTranslation();
  const timelineEnabled = import.meta.env.VITE_TIMELINE_ENABLED === 'true';
  const lifeReadingEnabled = timelineEnabled || import.meta.env.VITE_LIFE_READING_ENABLED === '1';
  return (
    <div className="w-full space-y-4 p-4 sm:p-6 lg:p-10">
      <header>
        <h2 className="text-2xl font-semibold">{t('profile.timelineTitle')}</h2>
        {!timelineEnabled && <p className="mt-1 text-sm text-gray-300">{t('profile.timelineSoon')}</p>}
      </header>
      {lifeReadingEnabled && <LifeReadingDashboard />}
      {timelineEnabled && <PastLifeReadingSection />}
      <LedgerSection embedded />
    </div>
  );
};

export default ProfileTimeline;
