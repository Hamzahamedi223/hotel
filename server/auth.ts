import crypto from 'node:crypto';

/**
 * Stateless session tokens: base64url(JSON payload) + "." + HMAC-SHA256.
 * The server never trusts a user id sent by the browser — it takes it from
 * a token only it could have signed.
 */

const TTL_SECONDS = 60 * 60 * 24 * 30; // stay signed in on a phone for 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is not configured.');
  return 'dev-only-secret-do-not-use-in-production';
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (body: string) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

export function issueToken(userId: number): string {
  const body = b64(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }));
  return `${body}.${sign(body)}`;
}

/** Returns the user id, or null if the token is missing, forged or expired. */
export function verifyToken(token: string | undefined | null): number | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = sign(body);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof uid !== 'number' || typeof exp !== 'number' || exp < Date.now() / 1000) return null;
    return uid;
  } catch {
    return null;
  }
}
