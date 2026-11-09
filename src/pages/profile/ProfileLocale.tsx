import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPlanState, updateProfile, type Language } from '../../Auth/api';
import LanguageField from '../../Auth/fields/LanguageField';
import RegionSwitch from '../../components/RegionSwitch';
import { useRegion } from '../../lib/region';
import ThemeSwitch from '../../components/ThemeSwitch';

const panelCls = 'glass glass-lift rounded-2xl p-4 sm:p-6';

/** Language and region together (Sachin, 2026-11-05); the account is in the avatar menu and Legal has its own page. */
const ProfileLocale: React.FC = () => {
  const { t } = useTranslation();
  const [region, setRegion] = useRegion();
  const [language, setLanguage] = useState<Language | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchPlanState().then((s) => {
      if (alive) setLanguage(s.language);
    });
    return () => {
      alive = false;
    };
  }, []);

  const saveLanguage = async () => {
    if (!language || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    // the server merges a partial update, and a language alone rebuilds no chart
    const r = await updateProfile({ language });
    if (r.success) setMessage(t('profile.saved'));
    else setError(r.message || t('profile.saveFailed'));
    setSaving(false);
  };

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-10">
      <header>
        <h2 className="text-2xl font-semibold">{t('profile.localeTitle')}</h2>
      </header>

      <section className={panelCls} aria-label={t('profile.appearance')}>
        <h3 className="font-semibold">{t('profile.appearance')}</h3>
        <p className="mb-3 mt-1 text-sm text-gray-300">{t('profile.appearanceHelp')}</p>
        <ThemeSwitch />
      </section>

      {language && (
        <section className={panelCls} aria-label={t('profile.language')}>
          <LanguageField
            value={language}
            onChange={(next) => {
              setLanguage(next);
              setMessage('');
              setError('');
            }}
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 text-sm text-emerald-200" aria-live="polite">
              {message}
            </p>
          )}
          <button
            type="button"
            onClick={() => void saveLanguage()}
            aria-busy={saving}
            className="mt-4 min-h-11 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-semibold text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {saving ? t('profile.saving') : t('profile.saveLanguage')}
          </button>
        </section>
      )}

      <section className={panelCls} aria-label={t('profile.region')}>
        <h3 className="font-semibold">{t('profile.region')}</h3>
        <p className="mb-3 mt-1 text-sm text-gray-300">{t('profile.regionHelp')}</p>
        <RegionSwitch value={region} onChange={setRegion} />
      </section>

    </div>
  );
};

export default ProfileLocale;
