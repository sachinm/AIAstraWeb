import React from 'react';

const LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  // The Refunds page exists at /refunds; its link is hidden for now.
];

/**
 * Opens in a new tab so a half-filled form or a running answer is not lost. `compact` is for the public footer on a phone:
 * one short line joined by dots, each link still a 24px tap target, rather than 44px rows that made the footer tall.
 */
const LegalLinks: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => (
  <nav aria-label="Legal" className={`flex flex-wrap justify-center ${compact ? 'gap-x-1.5 text-[11px] sm:gap-x-3 sm:text-xs' : 'gap-x-3 text-xs'} text-gray-400 ${className}`}>
    {LINKS.map((l, i) => (
      <React.Fragment key={l.href}>
        {compact && i > 0 && <span className="text-gray-500 sm:hidden" aria-hidden="true">·</span>}
        <a href={l.href} target="_blank" rel="noopener noreferrer" className={`inline-flex ${compact ? 'min-h-6' : 'min-h-11'} items-center underline underline-offset-2 hover:text-white sm:inline sm:min-h-0`}>
          {l.label}
        </a>
      </React.Fragment>
    ))}
  </nav>
);

export default LegalLinks;
