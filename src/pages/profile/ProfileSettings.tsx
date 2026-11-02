import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPlanState, fetchProfile, updateProfile, type Language } from '../../Auth/api';
import LanguageField from '../../Auth/fields/LanguageField';
import RegionSwitch from '../../components/RegionSwitch';
import { SUPPORT_EMAIL } from '../../lib/legal';
import { useRegion } from '../../lib/region';

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';
const linkCls = 'inline-flex min-h-11 items-center underline underline-offset-2 hover:text-white sm:min-h-0';

const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const [region, setRegion] = useRegion();
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<Language | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchProfile().then((p) => {
      if (alive && p?.email) setEmail(p.email);
    });
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
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h2 className="text-2xl font-semibold">{t('profile.settingsTitle')}</h2>
      </header>

      {email && (
        <section className={panelCls} aria-label={t('profile.account')}>
          <h3 className="font-semibold">{t('profile.account')}</h3>
          <p className="mt-2 break-all text-sm text-gray-300">{email}</p>
        </section>
      )}

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

      <section className={panelCls} aria-label={t('profile.legal')}>
        <h3 className="font-semibold">{t('profile.legal')}</h3>
        <ul className="mt-2 text-sm text-gray-300 sm:space-y-2">
          <li><a href="/terms" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.terms')}</a></li>
          <li><a href="/privacy" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.privacy')}</a></li>
          <li><a href="/refunds" target="_blank" rel="noopener noreferrer" className={linkCls}>{t('profile.refunds')}</a></li>
        </ul>
      </section>

      <section className={panelCls} aria-label={t('profile.closeAccount')}>
        <h3 className="font-semibold">{t('profile.closeAccount')}</h3>
        <p className="mt-1 text-sm text-gray-300">
          {SUPPORT_EMAIL ? (
            <>
              {t('profile.closeAccountEmail')}{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-white">
                {SUPPORT_EMAIL}
              </a>
              .
            </>
          ) : (
            t('profile.closeAccountSoon')
          )}
        </p>
      </section>
    </div>
  );
};

export default ProfileSettings;
