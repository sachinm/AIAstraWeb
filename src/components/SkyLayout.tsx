import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CosmicSky from './CosmicSky';
import PublicFrame from './PublicFrame';

/**
 * Pages that are one form: on a wide screen the form takes a left column (index.css). The scene stays full screen behind
 * it, just as on the home page (Sachin, 2026-11-05: a shrunk scene showed where it ended).
 */
const FORM_PATHS = ['/signin', '/signup', '/signup/details'];

/**
 * The home page, sign-in and sign-up share this layout, so the scenes keep playing across a move between them and are
 * never drawn again. Only the page on top changes, fading in.
 */
const SkyLayout: React.FC = () => {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '');
  const formPage = FORM_PATHS.includes(path);
  return (
    <>
      <CosmicSky />
      <PublicFrame>
        <div key={pathname} className={`sky-page h-full${formPage ? ' sky-form-page' : ''}`} data-test-id="sky-page">
          <Outlet />
        </div>
      </PublicFrame>
    </>
  );
};

export default SkyLayout;
