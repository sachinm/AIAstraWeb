import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePlan } from '../../Auth/ProfileGate';

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';

/** What the account has now. Access comes from the plan the server reports; a choice not yet paid for is only shown as a choice. */
const ProfilePlan: React.FC = () => {
  const { t } = useTranslation();
  const { plan } = usePlan();
  const names = { free: t('menu.planFree'), plus: t('menu.planPlus'), unlimited: t('menu.planUnlimited') };

  const body = () => {
    if (!plan) return <p className="text-gray-300">{t('profile.planMissing')}</p>;
    if (plan.exempt) return <p className="text-gray-300">{t('profile.planExempt')}</p>;
    const { used, limit } = plan;
    const chosen = !plan.is_paid && plan.desired_plan && plan.desired_plan !== plan.code ? plan.desired_plan : null;
    return (
      <>
        <p className="text-xl font-semibold text-purple-200">{names[plan.code]}</p>
        {plan.interval && (
          <p className="mt-1 text-sm text-gray-300">{plan.interval === 'year' ? t('profile.billedYearly') : t('profile.billedMonthly')}</p>
        )}
        <p className="mt-4 text-sm text-gray-200">
          {limit === null ? t('profile.usedUnlimited', { used }) : t('usage.used', { used: Math.min(used, limit), limit })}
        </p>
        {limit !== null && (
          <div role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)} className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-purple-500" style={{ width: `${limit > 0 ? (Math.min(used, limit) / limit) * 100 : 100}%` }} />
          </div>
        )}
        {plan.resets_at && (
          <p className="mt-2 text-sm text-gray-400">
            {t('profile.resetsOn', {
              date: new Date(plan.resets_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
            })}
          </p>
        )}
        {chosen && (
          <p role="status" className="mt-4 rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-purple-100">
            {t('profile.chosenPending', { plan: names[chosen] })}
          </p>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h2 className="text-2xl font-semibold">{t('profile.planTitle')}</h2>
      </header>
      <section className={panelCls} aria-label={t('profile.planTitle')}>
        {body()}
        <Link
          to="/pricing"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-semibold text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {t('profile.seePlans')}
        </Link>
      </section>
    </div>
  );
};

export default ProfilePlan;
