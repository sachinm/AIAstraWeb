import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // the theme class on <html> (src/lib/theme.ts); light mode's colours are in src/theme-light.css
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [typography],
};
