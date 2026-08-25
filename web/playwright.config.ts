import { defineConfig, devices } from '@playwright/test';

// Port 3000 is the machine's busiest port — another Next app was found squatting on
// it. `reuseExistingServer` would have handed the whole suite to that app and passed
// or failed against the wrong thing. Own a port, and always start our own server.
const PORT = 3100;
// Next 16 refuses to run a second dev server for the same directory, so a manual
// playtest server blocks the suite. Point at it instead when asked. The identity
// spec is the safety net: it fails loudly if we ever land on the wrong app.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const USE_OWN_SERVER = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: USE_OWN_SERVER
    ? {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        // Never adopt a server we did not start. A stranger on this port must be a
        // loud failure, not a silent pass against someone else's application.
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
