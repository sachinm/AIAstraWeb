import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlan } from '../Auth/ProfileGate';

/** Free plan only: this month's questions, in the top navigation on every signed-in page. */
const UsageBar: React.FC = () => {
  const { t } = useTranslation();
  const { plan } = usePlan();
  if (!plan || plan.exempt || plan.code !== 'free' || plan.limit === null) return null;

  const { used, limit } = plan;
  const left = Math.max(0, limit - used);
  const tone = left === 0 ? 'red' : left === 1 ? 'amber' : 'purple';
  const words = left === 1 ? t('usage.lastOne') : t('usage.used', { used: Math.min(used, limit), limit });
  const fill = { red: 'bg-red-500', amber: 'bg-amber-400', purple: 'bg-purple-500' }[tone];
  const text = { red: 'text-red-200', amber: 'text-amber-200', purple: 'text-gray-200' }[tone];
  const percent = limit > 0 ? (Math.min(used, limit) / limit) * 100 : 100;

  return (
    <div data-test-id="usage-bar" data-tone={tone} className="flex min-w-0 max-w-xl flex-1 items-center gap-3 text-xs sm:text-sm">
      <div className="min-w-0 flex-1">
        <p className={`truncate ${text}`} aria-live="polite">
          {words}
        </p>
        <div
          role="progressbar"
          aria-label={t('usage.label')}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div className={`h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
};

export default UsageBar;
