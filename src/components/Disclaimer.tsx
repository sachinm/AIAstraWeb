import React from 'react';

/** Shown on every dashboard page and under the chat input (Sachin, 2026-11-01). Not yet reviewed by a lawyer. */
export const DISCLAIMER_TEXT =
  'For education and entertainment purposes only. Not medical, legal, financial or other professional advice. By using this service, you accept sole responsibility for your decisions.';

interface DisclaimerProps {
  className?: string;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ className = '' }) => (
  <p role="note" data-test-id="disclaimer" className={`text-center text-xs leading-snug text-slate-400 ${className}`}>
    {DISCLAIMER_TEXT}
  </p>
);

export default Disclaimer;
