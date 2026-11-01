import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePlan } from '../Auth/ProfileGate';

/** Free plan only: how many of the free questions are gone, on every signed-in page. */
const UsageBar: React.FC = () => {
  const { t } = useTranslation();
  const { plan } = usePlan();
  if (!plan || plan.exempt || plan.code !== 'free' || plan.limit === null) return null;

  const { used, limit } = plan;
  const left = Math.max(0, limit - used);
  const tone = left === 0 ? 'red' : left === 1 ? 'amber' : 'purple';
  const words =
    left === 0 ? t('usage.allUsed', { limit }) : left === 1 ? t('usage.lastOne') : t('usage.used', { used, limit });
  const fill = { red: 'bg-red-500', amber: 'bg-amber-400', purple: 'bg-purple-500' }[tone];
  const text = { red: 'text-red-200', amber: 'text-amber-200', purple: 'text-gray-200' }[tone];

  return (
    <div data-test-id="usage-bar" data-tone={tone} className="shrink-0 border-b border-white/10 bg-black/30 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-sm">
        <span className={`shrink-0 ${text}`} aria-live="polite">
          {words}
        </span>
        <div
          role="progressbar"
          aria-label={t('usage.label')}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10"
        >
          <div className={`h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${(Math.min(used, limit) / limit) * 100}%` }} />
        </div>
        <Link to="/pricing" className="shrink-0 font-medium text-purple-300 hover:text-purple-200">
          {t('usage.upgrade')}
        </Link>
      </div>
    </div>
  );
};

export default UsageBar;
