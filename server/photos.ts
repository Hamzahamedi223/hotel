import crypto from 'node:crypto';

/**
 * Supabase Storage. With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set:
 *  - ticket photos go to a public bucket under unguessable names and the DB
 *    keeps only the URL (without them — local dev — the data URL itself is stored);
 *  - archive PDFs go to a private bucket, downloaded through short-lived signed URLs.
 */

const PHOTO_BUCKET = 'panne-photos';
export const ARCHIVE_BUCKET = 'archives';
const readyBuckets = new Set<string>();

export function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

const headers = (key: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${key}`, apikey: key, ...extra });

async function ensureBucket(url: string, key: string, bucket: string, isPublic: boolean) {
  if (readyBuckets.has(bucket)) return;
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: bucket, name: bucket, public: isPublic }),
  });
  // 400/409 = already exists
  if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Stockage indisponible (${res.status}).`);
  readyBuckets.add(bucket);
}

async function upload(bucket: string, isPublic: boolean, name: string, bytes: Buffer, mime: string) {
  const cfg = storageConfig()!;
  await ensureBucket(cfg.url, cfg.key, bucket, isPublic);
  const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${name}`, {
    method: 'POST',
    headers: headers(cfg.key, { 'Content-Type': mime }),
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`Échec de l'envoi du fichier (${res.status}).`);
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

  const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(16).toString('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`;
  await upload(PHOTO_BUCKET, true, name, bytes, mime);
  return `${cfg.url}/storage/v1/object/public/${PHOTO_BUCKET}/${name}`;
}

/** The image bytes behind a panne_photos.file_path (storage URL or data URL), or null if unreadable. */
export async function readPhoto(filePath: string): Promise<Buffer | null> {
  try {
    const m = /^data:image\/[a-z]+;base64,(.+)$/.exec(filePath);
    if (m) return Buffer.from(m[1], 'base64');
    // only our own bucket: a restored backup could hold any URL
    const cfg = storageConfig();
    if (!cfg || !filePath.startsWith(`${cfg.url}/storage/v1/object/public/${PHOTO_BUCKET}/`)) return null;
    const res = await fetch(filePath);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Best-effort removal of stored photo files (data-URL photos have no file). */
export async function deletePhotoFiles(filePaths: string[]) {
  const cfg = storageConfig();
  if (!cfg) return;
  const prefix = `${cfg.url}/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const names = filePaths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
  await removeObjects(PHOTO_BUCKET, names);
}

async function removeObjects(bucket: string, names: string[]) {
  const cfg = storageConfig();
  if (!cfg || names.length === 0) return;
  for (let i = 0; i < names.length; i += 500) {
    await fetch(`${cfg.url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: headers(cfg.key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: names.slice(i, i + 500) }),
    }).catch(() => {});
  }
}

/** Saves an archive PDF. Returns its storage name, or null when there is no storage (the caller keeps the bytes in the DB). */
export async function storeArchivePdf(name: string, pdf: Buffer): Promise<string | null> {
  if (!storageConfig()) return null;
  await upload(ARCHIVE_BUCKET, false, name, pdf, 'application/pdf');
  return name;
}

export async function deleteArchivePdf(name: string) {
  await removeObjects(ARCHIVE_BUCKET, [name]);
}

/** A 10-minute download link for a private archive PDF. */
export async function archiveDownloadUrl(name: string, downloadAs: string): Promise<string> {
  const cfg = storageConfig();
  if (!cfg) throw new Error('Stockage non configuré.');
  const res = await fetch(`${cfg.url}/storage/v1/object/sign/${ARCHIVE_BUCKET}/${name}`, {
    method: 'POST',
    headers: headers(cfg.key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) throw new Error(`Archive introuvable dans le stockage (${res.status}).`);
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${cfg.url}/storage/v1${signedURL}${signedURL.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadAs)}`;
}
