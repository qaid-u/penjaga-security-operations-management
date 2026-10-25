import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/phase7',
  testMatch: '**/*.spec.mjs',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // These interface tests intercept API responses. Genuine database/provider tests are separate.
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4179 --strictPort',
    env: { VITE_API_URL: 'http://127.0.0.1:3097/api', VITE_API_ORIGIN: 'http://127.0.0.1:3097' },
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
