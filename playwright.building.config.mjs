import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/building', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4175', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 30000, stdout: 'pipe', stderr: 'pipe' },
});
