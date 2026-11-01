import { defineConfig } from '@playwright/test';

/** The screenshot walkthrough (e2e/README.md). Uses the installed Chrome, and a stubbed API, so it touches no real data. */
const PORT = 5199;

export default defineConfig({
  testDir: '.',
  outputDir: '../node_modules/.cache/playwright',
  // one worker, so each folder's screenshots and manifest are written in step order
  workers: 1,
  fullyParallel: false,
  timeout: 600_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    locale: 'en-US',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --mode e2e`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
