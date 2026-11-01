import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Region } from '../lib/billing';

/** Inline SVG, because Windows browsers show flag emoji as letters. */
const UsFlag = () => (
  <svg viewBox="0 0 19 10" className="h-3.5 w-5 rounded-sm" aria-hidden="true" data-test-id="flag-us">
    <rect width="19" height="10" fill="#fff" />
    {[0, 2, 4, 6, 8].map((y) => (
      <rect key={y} y={y} width="19" height="1" fill="#b22234" />
    ))}
    <rect width="8" height="5" fill="#3c3b6e" />
    {[1, 3, 5, 7].flatMap((x) => [1, 2.5, 4].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.35" fill="#fff" />))}
  </svg>
);

const IndiaFlag = () => (
  <svg viewBox="0 0 18 12" className="h-3.5 w-5 rounded-sm" aria-hidden="true" data-test-id="flag-in">
    <rect width="18" height="4" fill="#ff9933" />
    <rect y="4" width="18" height="4" fill="#fff" />
    <rect y="8" width="18" height="4" fill="#138808" />
    <circle cx="9" cy="6" r="1.6" fill="none" stroke="#000080" strokeWidth="0.35" />
    <circle cx="9" cy="6" r="0.35" fill="#000080" />
  </svg>
);

interface RegionSwitchProps {
  value: Region;
  onChange: (region: Region) => void;
}

/** US | India: sets the currency of the prices shown. */
const RegionSwitch: React.FC<RegionSwitchProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const options: { id: Region; label: string; Flag: React.FC }[] = [
    { id: 'US', label: t('region.us'), Flag: UsFlag },
    { id: 'IN', label: t('region.india'), Flag: IndiaFlag },
  ];
  return (
    <div role="group" aria-label={t('region.label')} className="inline-flex items-center rounded-full border border-white/20 bg-white/5 p-1">
      {options.map(({ id, label, Flag }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            value === id ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:text-white'
          }`}
        >
          <Flag />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default RegionSwitch;
