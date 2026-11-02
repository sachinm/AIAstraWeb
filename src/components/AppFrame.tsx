import React from 'react';

/** The page chrome around the routes. Shared by the browser app and the build-time prerender so both emit the same markup. */
const AppFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen relative overflow-x-hidden">
    <div className="app-sky fixed inset-0 z-0" aria-hidden="true" />

    <div className="relative z-10">{children}</div>
  </div>
);

export default AppFrame;
