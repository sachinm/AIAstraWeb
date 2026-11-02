import React from 'react';

const LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
];

/** Opens in a new tab so a half-filled form or a running answer is not lost. */
const LegalLinks: React.FC<{ className?: string }> = ({ className = '' }) => (
  <nav aria-label="Legal" className={`flex flex-wrap justify-center gap-x-3 text-xs text-gray-400 ${className}`}>
    {LINKS.map((l) => (
      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-white sm:inline sm:min-h-0">
        {l.label}
      </a>
    ))}
  </nav>
);

export default LegalLinks;
