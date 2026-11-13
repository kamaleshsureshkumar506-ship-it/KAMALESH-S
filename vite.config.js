import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function apiDevPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/admin/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        let handlerModule;
        if (pathname === '/api/admin/login') {
          handlerModule = await import('./api/admin/login.js');
        } else if (pathname === '/api/admin/auth-check') {
          handlerModule = await import('./api/admin/auth-check.js');
        } else if (pathname === '/api/admin/logout') {
          handlerModule = await import('./api/admin/logout.js');
        } else if (pathname === '/api/admin/poems') {
          handlerModule = await import('./api/admin/poems.js');
        } else if (pathname === '/api/admin/categories') {
          handlerModule = await import('./api/admin/categories.js');
        }

        if (!handlerModule || !handlerModule.default) {
          return next();
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch {
            req.body = body;
          }
          req.query = Object.fromEntries(url.searchParams.entries());

          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };

          try {
            await handlerModule.default(req, res);
          } catch (err) {
            console.error('API Dev error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  build: {
    // Disable source maps in production to prevent source code exposure
    sourcemap: false,
  },
})
