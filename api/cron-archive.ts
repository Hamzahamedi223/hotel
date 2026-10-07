import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * GET /api/cron-archive — called weekly by Vercel Cron (vercel.json).
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET
 * environment variable is set; without it the job refuses to run, so nobody
 * else can trigger deletions.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const send = (status: number, payload: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
  };
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(500, { error: 'CRON_SECRET is not set in Vercel; the weekly archive is disabled.' });
  if (req.headers.authorization !== `Bearer ${secret}`) return send(401, { error: 'Unauthorized' });

  try {
    const { scheduledArchive } = await import('../server/rpc.js');
    const result = await scheduledArchive();
    console.log('weekly archive:', JSON.stringify(result));
    send(200, result);
  } catch (err: any) {
    console.error('weekly archive failed:', err);
    send(500, { error: err?.message ?? String(err) });
  }
}
