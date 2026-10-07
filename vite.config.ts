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
  // Make DATABASE_URL etc. from .env visible to the dev API. Variables already
  // set in the shell win, so `DATABASE_URL= npm run dev` uses the local database.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (!(k in process.env)) process.env[k] = v;
  }
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
