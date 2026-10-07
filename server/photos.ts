import crypto from 'node:crypto';

/**
 * Ticket photos. With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set they go to
 * a public Supabase Storage bucket under unguessable names and the DB keeps
 * only the URL; without them (local dev) the data URL itself is stored.
 */

const BUCKET = 'panne-photos';
let bucketReady = false;

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function ensureBucket(url: string, key: string) {
  if (bucketReady) return;
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 400/409 = already exists
  if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Stockage photos indisponible (${res.status}).`);
  bucketReady = true;
}

/** Stores an image sent as a data URL; returns what to save in panne_photos.file_path. */
export async function storePhoto(dataUrl: string): Promise<string> {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!m) throw new Error('Image invalide.');
  const [, mime, ext, b64] = m;
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length > 3 * 1024 * 1024) throw new Error('Image trop lourde (max 3 Mo).');

  const cfg = storageConfig();
  if (!cfg) return dataUrl;

  await ensureBucket(cfg.url, cfg.key);
  const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(16).toString('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': mime },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Échec de l'envoi de la photo (${res.status}).`);
  return `${cfg.url}/storage/v1/object/public/${BUCKET}/${name}`;
}
