/**
 * Build-time prerender entry (see scripts/prerender.ts). Renders a public route to static markup with a signed-out
 * visitor and a ready session, which is what a crawler or link preview should see. The browser app still mounts with
 * `createRoot` and replaces this markup.
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AppFrame from './components/AppFrame';
import AppRoutes from './routes';
import AuthProvider from './Auth/AuthProvider';
import { headTagsFor, type HeadTag } from './lib/seo';
import './i18n';

const noop = () => undefined;

export function renderRoute(pathname: string): string {
  return renderToString(
    <AppFrame>
      <StaticRouter location={pathname}>
        <AuthProvider user={null} setUser={noop} isAuthenticated={false} setIsAuthenticated={noop}>
          <AppRoutes
            user={null}
            isAuthenticated={false}
            sessionReady
            handleSignIn={noop}
            handleSignUp={noop}
            handleLogout={noop}
          />
        </AuthProvider>
      </StaticRouter>
    </AppFrame>,
  );
}

export { headTagsFor };
export type { HeadTag };
