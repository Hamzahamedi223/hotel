import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Serves /api/rpc from the dev server, the same handler Vercel deploys. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/rpc', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/rpc.ts');
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make DATABASE_URL etc. from .env visible to the dev API
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), devApi()],
    build: {
      outDir: 'dist',
    },
    server: {
      port: 5175,
      strictPort: true,
      host: true, // reachable from a phone on the same Wi-Fi while developing
    },
  };
});
