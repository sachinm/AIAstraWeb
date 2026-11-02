import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** A page that could not load: plain words and Retry. The raw message goes to the console only. */
const LoadError: React.FC<{ detail?: string | null; onRetry: () => void }> = ({ detail, onRetry }) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (detail) console.debug('page load failed', detail);
  }, [detail]);
  return (
    <div role="alert" className="mx-4 mt-16 max-w-md rounded-2xl sm:mx-auto border border-white/15 bg-slate-900/80 p-6 text-center text-gray-200">
      <AlertCircle className="mx-auto mb-3 h-6 w-6 text-amber-300" aria-hidden="true" />
      <p>{t('errors.pageLoad')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-lg bg-white/10 px-5 font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        {t('sidebar.retry')}
      </button>
    </div>
  );
};

export default LoadError;
