import React from 'react';
import { useTranslation } from 'react-i18next';

const linkCls = 'inline-flex min-h-11 items-center underline underline-offset-2 hover:text-white sm:min-h-0';

/** The legal pages, on their own profile tab (Sachin, 2026-11-05). */
const ProfileLegal: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-10">
      <header>
        <h2 className="text-2xl font-semibold">{t('profile.legal')}</h2>
      </header>
      <section className="glass glass-lift rounded-2xl p-4 sm:p-6" aria-label={t('profile.legal')}>
        <ul className="text-sm text-gray-300 sm:space-y-2">
          <li><a href="/terms" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.terms')}</a></li>
          <li><a href="/privacy" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.privacy')}</a></li>
          <li><a href="/refunds" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.refunds')}</a></li>
        </ul>
      </section>
    </div>
  );
};

export default ProfileLegal;
