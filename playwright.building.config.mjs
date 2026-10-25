import { defineConfig } from '@playwright/test';
const port = Number(process.env.BUILDING_TEST_PORT || 4175);
export default defineConfig({
  outputDir: './test-results/building',
  testDir: './tests/building', timeout: 60000, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 30000, stdout: 'pipe', stderr: 'pipe' },
});
