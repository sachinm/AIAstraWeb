import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

/** The screenshot walkthrough (e2e/README.md). Uses the installed Chrome, and a stubbed API, so it touches no real data. */
// E2E_PORT lets two worktrees run their walkthroughs at once
const PORT = Number(process.env.E2E_PORT) || 5199;
const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(E2E_DIR, '..');

export default defineConfig({
  testDir: E2E_DIR,
  outputDir: path.join(ROOT_DIR, 'node_modules/.cache/playwright'),
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
    // a built bundle, not the dev server: hundreds of module requests per page time out when memory is short
    command: `npx vite build --mode e2e --outDir node_modules/.cache/e2e-dist --emptyOutDir && npx vite preview --port ${PORT} --strictPort --mode e2e --outDir node_modules/.cache/e2e-dist`,
    cwd: ROOT_DIR,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // E2E_WEB_TIMEOUT_MS: a slow or busy machine needs longer for the build
    timeout: Number(process.env.E2E_WEB_TIMEOUT_MS) || 180_000,
  },
});
