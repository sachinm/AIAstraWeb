import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CosmicSky from './CosmicSky';
import PublicFrame from './PublicFrame';

/** Pages that are one form: it is placed clear of the scene, by screen shape (index.css). */
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
      <CosmicSky side={formPage} />
      <PublicFrame>
        <div key={pathname} className={`sky-page h-full${formPage ? ' sky-form-page' : ''}`} data-test-id="sky-page">
          <Outlet />
        </div>
      </PublicFrame>
    </>
  );
};

export default SkyLayout;
