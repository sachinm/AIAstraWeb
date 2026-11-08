import { useCallback, useEffect, useState } from 'react';
import { fetchCurrentTermsVersion } from './api';
import { TERMS_VERSION } from '../lib/legal';

/**
 * The Terms version to send with the 18+ and Terms of Use box. Starts as the version this build was made with and
 * is replaced by the server's `currentTerms.version` once read (on mount, and again via `refresh` after a
 * terms_outdated answer). If the server cannot be asked, the build's version is sent and the server decides.
 */
export function useTermsVersion(): { version: string; refresh: () => Promise<string> } {
  const [version, setVersion] = useState(TERMS_VERSION);

  const refresh = useCallback(async () => {
    const v = (await fetchCurrentTermsVersion()) ?? TERMS_VERSION;
    setVersion(v);
    return v;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCurrentTermsVersion().then((v) => {
      if (alive && v) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { version, refresh };
}
