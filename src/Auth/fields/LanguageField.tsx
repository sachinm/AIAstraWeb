import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../api';

/** Hindi for a browser set to Hindi, otherwise English. */
export function defaultLanguage(): Language {
  try {
    return navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

interface LanguageFieldProps {
  value: Language;
  onChange: (language: Language) => void;
}

/** English or Hindi. Stored on the account; Hindi text comes later, and the note says so. */
const LanguageField: React.FC<LanguageFieldProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const options: { id: Language; label: string }[] = [
    { id: 'en', label: t('language.english') },
    { id: 'hi', label: t('language.hindi') },
  ];
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-300 mb-2">{t('language.label')}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-white">
            <input
              type="radio"
              name="language"
              value={o.id}
              checked={value === o.id}
              required
              onChange={() => onChange(o.id)}
              className="h-4 w-4 accent-purple-500"
            />
            {o.label}
          </label>
        ))}
      </div>
      {value === 'hi' && (
        <p role="note" className="mt-2 text-sm text-purple-200">
          {t('language.hindiSoon')}
        </p>
      )}
    </fieldset>
  );
};

export default LanguageField;
