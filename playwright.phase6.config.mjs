import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/phase6',timeout:180000,workers:1,
  use:{baseURL:'http://127.0.0.1:4180',channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',viewport:{width:1440,height:1000},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure'},
  webServer:[
    {command:'node backend/scripts/phase6-demo-server.js',env:{NLP_AI_REVIEW_ENABLED:'false',PHASE6_PORT:'3098'},url:'http://127.0.0.1:3098/api/health',reuseExistingServer:false,timeout:60000},
    {command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4180 --strictPort',env:{VITE_API_URL:'http://127.0.0.1:3098/api',VITE_API_ORIGIN:'http://127.0.0.1:3098'},url:'http://127.0.0.1:4180',reuseExistingServer:false,timeout:60000}
  ]
});
