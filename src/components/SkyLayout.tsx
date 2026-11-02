import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CosmicSky from './CosmicSky';
import PublicFrame from './PublicFrame';

/**
 * The home page, sign-in and sign-up share this layout, so the scenes keep playing across a move between them and are
 * never drawn again. Only the page on top changes, fading in.
 */
const SkyLayout: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <>
      <CosmicSky />
      <PublicFrame>
        <div key={pathname} className="sky-page h-full" data-test-id="sky-page">
          <Outlet />
        </div>
      </PublicFrame>
    </>
  );
};

export default SkyLayout;
