import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/phase5',timeout:90000,workers:1,
  use:{baseURL:'http://127.0.0.1:4176',channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:[
    {command:'node backend/scripts/phase5-demo-server.js',url:'http://127.0.0.1:3095/api/health',reuseExistingServer:false,timeout:90000},
    {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4176 --strictPort',env:{VITE_API_URL:'http://127.0.0.1:3095/api',VITE_API_ORIGIN:'http://127.0.0.1:3095'},url:'http://127.0.0.1:4176',reuseExistingServer:false,timeout:90000}
  ]
});
