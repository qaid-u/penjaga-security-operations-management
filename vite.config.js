import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const privatePaths = /(?:^|\/)(?:\.env(?:\.[^/]+)?|\.git|\.github|\.npmrc|\.vercel|\.openai|[^/]+\.(?:local|log|dump|backup|pem|key|crt)|backend|artifacts|docs|test-results|playwright-report)(?:\/|$)/i

function denyPrivatePaths() {
  return {
    name: 'deny-private-paths',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let pathname;
        try { pathname = decodeURIComponent((req.url || '/').split('?')[0]).replaceAll('\\', '/'); }
        catch { res.statusCode = 400; res.end('Invalid URL'); return; }
        if (privatePaths.test(pathname)) {
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
    fs: { deny: ['**/.env*', '**/.npmrc', '**/*.{crt,pem,key,dump,backup,local,log}', '**/.git/**', '**/.github/**', '**/.vercel/**', '**/.openai/**', '**/*.local/**', '**/backend/**', '**/docs/**', '**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] },
    watch: { ignored: ['**/backend/**', '**/.*.local/**', '**/artifacts/**', '**/docs/**', '**/test-results/**', '**/playwright-report/**'] },
  },
})
