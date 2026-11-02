import React from 'react';

/** Shown on every dashboard page and under the chat input (Sachin, 2026-11-01). Not yet reviewed by a lawyer. */
export const DISCLAIMER_LINE_1 = 'For education and entertainment purposes only. Not medical, legal, financial or other professional advice.';
export const DISCLAIMER_LINE_2 = 'By using this service, you accept sole responsibility for your decisions.';
export const DISCLAIMER_TEXT = `${DISCLAIMER_LINE_1} ${DISCLAIMER_LINE_2}`;

/** The public footer on a phone. */
export const DISCLAIMER_SHORT = 'For education and entertainment only. Not professional advice.';

interface DisclaimerProps {
  className?: string;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ className = '' }) => (
  <p role="note" data-test-id="disclaimer" className={`text-center text-xs leading-snug text-slate-400 ${className}`}>
    <span className="block">{DISCLAIMER_LINE_1}</span>{' '}
    <span className="block">{DISCLAIMER_LINE_2}</span>
  </p>
);

export default Disclaimer;
