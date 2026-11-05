/** The visitor's region (US or India) and how prices read in it. */
import { useCallback, useEffect, useState } from 'react';
import { fetchPlans, type Region } from './billing';

export const REGION_KEY = 'aiastra.region';

export function loadRegion(): Region | null {
  try {
    const v = localStorage.getItem(REGION_KEY);
    return v === 'US' || v === 'IN' ? v : null;
  } catch {
    return null;
  }
}

export function saveRegion(region: Region): void {
  try {
    localStorage.setItem(REGION_KEY, region);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/** en-IN groups rupees as 1,00,000. */
export function formatPrice(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** The saved choice, else the country the server detected, else US. */
export function useRegion(): [Region, (region: Region) => void] {
  const [saved] = useState(loadRegion);
  const [region, setRegionState] = useState<Region>(saved ?? 'US');

  useEffect(() => {
    if (saved) return undefined;
    let alive = true;
    void fetchPlans().then((catalog) => {
      if (alive && catalog) setRegionState(catalog.region);
    });
    return () => {
      alive = false;
    };
  }, [saved]);

  const setRegion = useCallback((next: Region) => {
    saveRegion(next);
    setRegionState(next);
  }, []);

  return [region, setRegion];
}
