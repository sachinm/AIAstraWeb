import React from 'react';

/** Shown on every dashboard page and under the chat input (Sachin, 2026-10-25). */
export const DISCLAIMER_TEXT =
  'For education and entertainment purposes only. This is not financial advice, and lifestyle choices are your own.';

interface DisclaimerProps {
  className?: string;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ className = '' }) => (
  <p role="note" data-test-id="disclaimer" className={`text-center text-xs leading-snug text-slate-400 ${className}`}>
    {DISCLAIMER_TEXT}
  </p>
);

export default Disclaimer;
