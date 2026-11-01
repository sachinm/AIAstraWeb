import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PlanStatus } from '../lib/billing';

/** Takes the place of the chat input when no more questions can be asked. Earlier answers stay readable above it. */
const UpgradeCard: React.FC<{ plan: PlanStatus }> = ({ plan }) => {
  const { t } = useTranslation();
  const limit = plan.limit ?? 0;
  // the server's months turn over in UTC, so a local date would read a day early in the US
  const date = plan.resets_at
    ? new Date(plan.resets_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;
  const words = date ? t('quota.monthRenews', { limit, date }) : t('quota.month', { limit });
  return (
    <div role="status" data-test-id="upgrade-card" className="rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-3 text-sm text-gray-100">
      <p>
        {words} {plan.code === 'free' && t('quota.freeNext')}
      </p>
      <Link
        to="/pricing"
        className="mt-3 inline-block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-semibold text-white hover:from-purple-500 hover:to-pink-500"
      >
        {t('quota.choose')}
      </Link>
    </div>
  );
};

export default UpgradeCard;
