import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gaPageView, gaSetUser } from '../lib/ga';
import { getUserId } from '../lib/graphql';

/** Sends a Google Analytics page view on every route change, and ties the session to the signed-in person's id. */
export default function GaPageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    let id: string | null = null;
    try {
      id = getUserId() ?? null;
    } catch {
      id = null;
    }
    gaSetUser(id);
    gaPageView(pathname);
  }, [pathname]);
  return null;
}
