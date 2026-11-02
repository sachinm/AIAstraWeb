import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchPlanState } from '../../Auth/api';
import RegionSwitch from '../../components/RegionSwitch';
import {
  fetchPlans,
  startCheckout,
  type CatalogPlan,
  type PlanCatalog,
  type PlanInterval,
  type PlanStatus,
  type Region,
} from '../../lib/billing';
import { formatPrice, loadRegion, saveRegion } from '../../lib/region';

const signedIn = () => {
  try {
    return Boolean(localStorage.getItem('token'));
  } catch {
    return false;
  }
};

/** Public. The server picks the currency; the switch overrides the detected country. Nothing is charged until a gateway is set up. */
const PricingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [chosenRegion, setChosenRegion] = useState<Region | null>(loadRegion);
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [interval, setIntervalChoice] = useState<PlanInterval>('month');
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [savedName, setSavedName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignedIn = signedIn();

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    void fetchPlans(chosenRegion).then((c) => {
      if (!alive) return;
      setCatalog(c);
      setLoadFailed(!c);
    });
    return () => {
      alive = false;
    };
  }, [chosenRegion]);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    let alive = true;
    void fetchPlanState().then((s) => {
      if (alive) setPlan(s.plan);
    });
    return () => {
      alive = false;
    };
  }, [isSignedIn]);

  const onRegion = (region: Region) => {
    saveRegion(region);
    setChosenRegion(region);
  };

  const choose = async (p: CatalogPlan) => {
    if (!isSignedIn) {
      navigate('/signup');
      return;
    }
    setBusy(true);
    setError('');
    setSavedName('');
    try {
      const r = await startCheckout(p.code, interval, catalog?.region ?? chosenRegion);
      if (r.checkout_url) {
        window.location.assign(r.checkout_url);
        return;
      }
      if (r.plan) setPlan(r.plan);
      setSavedName(p.name);
    } catch {
      setError(t('pricing.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** Whole months saved by paying yearly, from the catalog's own prices. */
  const monthsFree = (p: CatalogPlan) => {
    const month = p.prices?.month?.amount_minor;
    const year = p.prices?.year?.amount_minor;
    return month && year ? Math.round((month * 12 - year) / month) : 0;
  };

  const limitWords = (p: CatalogPlan) =>
    p.limit === null ? t('pricing.limitUnlimited') : t('pricing.limitMonth', { limit: p.limit });

  // a choice saved earlier and not paid for yet says so when the person comes back
  const pendingName =
    savedName ||
    (plan && !plan.is_paid && plan.desired_plan && plan.desired_plan !== 'free'
      ? catalog?.plans.find((p) => p.code === plan.desired_plan)?.name
      : '');

  return (
    <div className="min-h-full px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(isSignedIn ? '/dashboard/chat' : '/')}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('pricing.back')}
          </button>
          <RegionSwitch value={catalog?.region ?? chosenRegion ?? 'US'} onChange={onRegion} />
        </div>

        <header className="mt-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t('pricing.title')}</h1>
          <p className="mt-2 text-gray-300">{t('pricing.subtitle')}</p>
        </header>

        <div role="group" aria-label={t('pricing.interval')} className="mt-6 flex justify-center gap-2">
          {(['month', 'year'] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              aria-pressed={interval === iv}
              onClick={() => setIntervalChoice(iv)}
              className={`rounded-full px-4 py-1.5 text-sm ${interval === iv ? 'bg-purple-600/40 text-white' : 'border border-white/20 text-gray-300 hover:text-white'}`}
            >
              {iv === 'month' ? t('pricing.monthly') : t('pricing.annual')}
            </button>
          ))}
        </div>

        {pendingName && (
          <p role="status" className="mt-6 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-center text-sm text-purple-100">
            {t('pricing.saved', { plan: pendingName })}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        )}
        {loadFailed && (
          <p role="alert" className="mt-8 text-center text-sm text-red-300">
            {t('pricing.loadFailed')}
          </p>
        )}
        {!catalog && !loadFailed && <p className="mt-8 text-center text-sm text-gray-300">{t('pricing.loading')}</p>}

        {catalog && (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {catalog.plans.map((p) => {
              const price = p.prices?.[interval];
              const current = plan?.code === p.code;
              return (
                <section key={p.code} aria-label={p.name} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <h2 className="text-xl font-semibold">{p.name}</h2>
                  <p className="mt-2 text-2xl font-bold">
                    {price
                      ? t(interval === 'month' ? 'pricing.perMonth' : 'pricing.perYear', { price: formatPrice(price.amount_minor, price.currency) })
                      : t('pricing.freePrice')}
                  </p>
                  {interval === 'year' && monthsFree(p) > 0 && (
                    <p className="mt-1 text-sm font-medium text-emerald-300">{t('pricing.monthsFree', { count: monthsFree(p) })}</p>
                  )}
                  <p className="mt-4 flex items-start gap-2 text-sm text-gray-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
                    {limitWords(p)}
                  </p>
                  <div className="mt-6 flex flex-1 items-end">
                    {current ? (
                      <p className="w-full rounded-lg border border-white/20 py-2 text-center text-sm text-gray-200">{t('pricing.current')}</p>
                    ) : p.prices ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void choose(p)}
                        className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-2 font-semibold text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-60"
                      >
                        {t('pricing.choose', { name: p.name })}
                      </button>
                    ) : !isSignedIn ? (
                      <button
                        type="button"
                        onClick={() => navigate('/signup')}
                        className="w-full rounded-lg border border-white/20 py-2 font-semibold text-white hover:bg-white/10"
                      >
                        {t('pricing.startFree')}
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingPage;
