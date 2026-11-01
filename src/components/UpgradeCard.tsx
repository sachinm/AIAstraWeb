import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PlanStatus } from '../lib/billing';

/** Takes the place of the chat input when no more questions can be asked. Earlier answers stay readable above it. */
const UpgradeCard: React.FC<{ plan: PlanStatus }> = ({ plan }) => {
  const { t } = useTranslation();
  const limit = plan.limit ?? 0;
  let words = t('quota.free', { limit });
  if (plan.window === 'day') words = t('quota.day');
  else if (plan.window === 'month') {
    words = plan.resets_at
      ? t('quota.monthRenews', { limit, date: new Date(plan.resets_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) })
      : t('quota.month', { limit });
  }
  return (
    <div role="status" data-test-id="upgrade-card" className="rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-purple-100">
      <p>{words}</p>
      {plan.window !== 'day' && (
        <Link
          to="/pricing"
          className="mt-3 inline-block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-semibold text-white hover:from-purple-700 hover:to-pink-700"
        >
          {t('quota.choose')}
        </Link>
      )}
    </div>
  );
};

export default UpgradeCard;
