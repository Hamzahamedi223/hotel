import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * POST /api/rpc  { method: "pannes:list", args: [...] }
 * Authorization: Bearer <token from auth:login>
 *
 * Deployed as a Vercel function; vite.config.ts mounts the same handler on
 * the dev server.
 */
export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  const send = (status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
  };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });

  // Loaded lazily so a startup failure (bad setting, missing module) comes back
  // as a readable message instead of Vercel's bare FUNCTION_INVOCATION_FAILED.
  let server: typeof import('../server/rpc.js');
  try {
    server = await import('../server/rpc.js');
  } catch (err: any) {
    console.error('API failed to start:', err);
    return send(500, { error: `Le serveur n'a pas pu démarrer : ${err?.message ?? err}` });
  }
  const { dispatch, RpcError } = server;

  try {
    const body = req.body ?? (await readJson(req));
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const result = await dispatch(String(body?.method ?? ''), body?.args ?? [], token);
    send(200, { result: result ?? null });
  } catch (err: any) {
    if (err instanceof RpcError) return send(err.status, { error: err.message });
    // Postgres constraint errors → readable French messages
    const message =
      err?.code === '23505' ? 'Cette valeur existe déjà (doublon).' :
      err?.code === '23503' ? 'Impossible : cet élément est utilisé ailleurs.' :
      err?.message ?? 'Erreur serveur.';
    if (!err?.message || err?.code) console.error(err);
    send(400, { error: message });
  }
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
