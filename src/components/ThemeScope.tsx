import { useLocation } from 'react-router-dom';
import { useAppliedTheme } from '../lib/theme';

/** Keeps the theme class on <html> in step with the route and the viewer's choice (lib/theme.ts). Draws nothing. */
const ThemeScope = () => {
  useAppliedTheme(useLocation().pathname);
  return null;
};

export default ThemeScope;
