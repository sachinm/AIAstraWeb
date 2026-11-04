import { StrictMode, useEffect } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { checkGraphQLStartupHealth } from './lib/graphql';
import { installAuthPrewarm } from './Auth/prewarm';
import { TURNSTILE_SITE_KEY } from './Auth/useTurnstile';
import './i18n';
import './index.css';

const GRAPHQL_STARTUP_CHECK_KEY = Symbol.for('adastra.graphql.startup-check-ran');

type GraphQLStartupCheckGlobal = typeof globalThis & {
  [GRAPHQL_STARTUP_CHECK_KEY]?: boolean;
};

function AppWithStartupChecks(): ReactElement {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const globalState = globalThis as GraphQLStartupCheckGlobal;
    if (globalState[GRAPHQL_STARTUP_CHECK_KEY]) return;

    globalState[GRAPHQL_STARTUP_CHECK_KEY] = true;
    void checkGraphQLStartupHealth();
  }, []);

  return <App />;
}

// heading for sign-up or sign-in starts fetching the security check's script (Auth/prewarm.ts)
if (TURNSTILE_SITE_KEY) installAuthPrewarm();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('[App] Missing #root element. Check index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppWithStartupChecks />
  </StrictMode>
);
