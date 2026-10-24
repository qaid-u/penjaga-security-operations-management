import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function denyPrivatePaths() {
  return {
    name: 'deny-private-paths',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let pathname;
        try { pathname = decodeURIComponent((req.url || '/').split('?')[0]).replaceAll('\\', '/'); }
        catch { res.statusCode = 400; res.end('Invalid URL'); return; }
        if (/^\/+((backend|artifacts|\.phase5-runtime\.local)(\/|$)|\.env([./]|$)|docs\/psm-evaluation\/data(\/|$))/i.test(pathname)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Access denied');
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [denyPrivatePaths(), react()],
  server: {
    fs: { deny: ['**/.env', '**/.env.*', '**/.git/**', '**/backend/**', '**/.phase5-runtime.local/**', '**/docs/psm-evaluation/data/**', '**/artifacts/**'] },
    watch: { ignored: ['**/backend/**', '**/.phase5-runtime.local/**', '**/artifacts/**', '**/docs/psm-evaluation/**'] },
  },
})
