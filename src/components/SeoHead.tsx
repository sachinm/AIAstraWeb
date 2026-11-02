import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo } from '../lib/seo';

/** Keeps the document head in step with the route: title, description, robots, canonical, Open Graph and JSON-LD. */
const SeoHead: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    applySeo(document, pathname, window.location.origin, window.location.hostname);
  }, [pathname]);
  return null;
};

export default SeoHead;
