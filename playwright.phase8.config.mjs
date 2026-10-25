import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/phase8',
  testMatch: '**/*.spec.mjs',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4180',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // API interception covers interface contracts; engine and HTTP validation have separate tests.
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4180 --strictPort',
    env: { VITE_API_URL: 'http://127.0.0.1:3098/api', VITE_API_ORIGIN: 'http://127.0.0.1:3098' },
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
