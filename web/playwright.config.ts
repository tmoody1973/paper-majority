import { defineConfig, devices } from '@playwright/test';

// Port 3000 is the machine's busiest port — another Next app was found squatting on
// it. `reuseExistingServer` would have handed the whole suite to that app and passed
// or failed against the wrong thing. Own a port, and always start our own server.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    // Never adopt a server we did not start. A stranger on this port must be a loud
    // failure, not a silent pass against someone else's application.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
