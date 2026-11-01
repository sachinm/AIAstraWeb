import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  resources: { en: { translation: en } },
  // React already escapes what it renders
  interpolation: { escapeValue: false },
});

export default i18n;
