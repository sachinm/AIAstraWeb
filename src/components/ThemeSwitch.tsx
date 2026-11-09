import React from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '../lib/theme';

/** System | Light | Dark, styled like the region switch beside it in Profile. */
const ThemeSwitch: React.FC = () => {
  const { t } = useTranslation();
  const [choice, setChoice] = useTheme();
  const options: { id: ThemeChoice; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'system', label: t('profile.themeSystem'), Icon: Monitor },
    { id: 'light', label: t('profile.themeLight'), Icon: Sun },
    { id: 'dark', label: t('profile.themeDark'), Icon: Moon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t('profile.appearance')}
      className="grid w-full grid-cols-3 gap-1 rounded-full border border-white/20 bg-white/5 p-1 sm:inline-flex sm:w-auto sm:items-center"
      data-test-id="theme-switch"
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={choice === id}
          onClick={() => setChoice(id)}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2 sm:px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            choice === id ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitch;
