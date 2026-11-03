import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  Browsers,
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type WASocket,
} from '@whiskeysockets/baileys';

/**
 * Sends the app's WhatsApp alerts from one ordinary WhatsApp number (linked
 * like WhatsApp Web), so it costs nothing. A long-lived process — `npm run
 * whatsapp` — because a serverless function can't hold the connection.
 *
 * It only talks to the app (APP_URL, /api/rpc gateway:* calls with
 * WHATSAPP_GATEWAY_SECRET): it pulls the queued messages, sends them and
 * acknowledges them, keeps the WhatsApp session in the app's database, and
 * reports its status — the QR code to scan appears in Réglages. So it can run
 * anywhere, on a PC or a free host that sleeps (GET /wake starts a pull).
 */

// The encryption library logs whole sessions, private keys included: keep them out of the host's logs.
for (const level of ['log', 'info', 'warn'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && /^(Closing|Opening|Removing old closed|Migrating) session|^Session already|^Closing stale open/.test(args[0])) return;
    original(...args);
  };
}

try {
  process.loadEnvFile('.env');
} catch {
  /* no .env: settings come from the environment (hosting) */
}

const APP_URL = (process.env.APP_URL || 'http://localhost:5175').replace(/\/$/, '');
const SECRET = process.env.WHATSAPP_GATEWAY_SECRET || '';
const PORT = Number(process.env.PORT || process.env.WHATSAPP_GATEWAY_PORT || 5176);
/** Free hosts sleep without inbound traffic; pinging our own public URL keeps the connection up. */
const KEEPALIVE_URL = (process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const POLL_MS = 30_000;
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

if (!SECRET) {
  console.error('WHATSAPP_GATEWAY_SECRET manquant (le même que dans l’app).');
  process.exit(1);
}

async function api<T = any>(method: string, ...args: unknown[]): Promise<T> {
  const res = await fetch(`${APP_URL}/api/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ method, args }),
    signal: AbortSignal.timeout(30_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method}: ${data.error ?? res.status}`);
  return data.result as T;
}

/* ---------- WhatsApp session, kept in the app's database --------------- */

/** Same key names as Baileys' multi-file auth state, so an old data/whatsapp-auth folder can be imported. */
const keyName = (file: string) => file.replace(/\//g, '__').replace(/:/g, '-');

class DbAuthStore {
  private data = new Map<string, string>();
  private dirty = new Map<string, string | null>();
  private resetPending = false;
  private timer: NodeJS.Timeout | null = null;

  async load() {
    this.data = new Map(Object.entries(await api<Record<string, string>>('gateway:stateLoad')));
    if (!this.data.has('creds')) this.importFolder(path.resolve('data/whatsapp-auth'));
  }

  /** A number linked before the session moved to the database keeps working without a new scan. */
  private importFolder(dir: string) {
    if (!fs.existsSync(path.join(dir, 'creds.json'))) return;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      this.write(f.slice(0, -5), fs.readFileSync(path.join(dir, f), 'utf8'));
    }
    log(`Session importée depuis ${dir} (${this.data.size} clés).`);
  }

  private read(key: string) {
    const v = this.data.get(key);
    return v == null ? null : JSON.parse(v, BufferJSON.reviver);
  }

  private write(key: string, json: string | null) {
    if (json == null) this.data.delete(key);
    else this.data.set(key, json);
    this.dirty.set(key, json);
    this.timer ??= setTimeout(() => void this.flush(), 1500);
  }

  async flush() {
    this.timer = null;
    if (!this.dirty.size && !this.resetPending) return;
    // a first sync writes thousands of keys; small batches stay under the host's request size limit
    const batch = [...this.dirty].slice(0, 1000);
    const reset = this.resetPending;
    for (const [k] of batch) this.dirty.delete(k);
    this.resetPending = false;
    try {
      await api('gateway:stateSave', Object.fromEntries(batch), reset);
      if (this.dirty.size) this.timer ??= setTimeout(() => void this.flush(), 200);
    } catch (err: any) {
      log('Sauvegarde de session échouée, nouvel essai :', err.message);
      for (const [k, v] of batch) if (!this.dirty.has(k)) this.dirty.set(k, v);
      this.resetPending ||= reset;
      this.timer ??= setTimeout(() => void this.flush(), 5000);
    }
  }

  pending() {
    return this.dirty.size > 0 || this.resetPending;
  }

  /** Forget the linked number (here and in the database). */
  clear() {
    this.data.clear();
    this.dirty.clear();
    this.resetPending = true;
    this.timer ??= setTimeout(() => void this.flush(), 0);
  }

  authState(): { state: AuthenticationState; saveCreds: () => void } {
    const creds = this.read('creds') ?? initAuthCreds();
    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const out: Record<string, any> = {};
            for (const id of ids) {
              let value = this.read(keyName(`${type}-${id}`));
              if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
              out[id] = value;
            }
            return out;
          },
          set: async (data: any) => {
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                this.write(keyName(`${category}-${id}`), value ? JSON.stringify(value, BufferJSON.replacer) : null);
              }
            }
          },
        },
      },
      saveCreds: () => this.write('creds', JSON.stringify(creds, BufferJSON.replacer)),
    };
  }
}

/* ---------- connection ------------------------------------------------- */

const store = new DbAuthStore();
let sock: WASocket | null = null;
let status: 'connecting' | 'qr' | 'open' | 'logged_out' = 'connecting';
let qrImage: string | null = null;

const myNumber = () => sock?.user?.id?.split(':')[0]?.split('@')[0] ?? null;

async function report() {
  try {
    await api('gateway:status', status, myNumber() ? `+${myNumber()}` : null, qrImage);
  } catch (err: any) {
    log('Statut non envoyé :', err.message);
  }
}

async function connect() {
  const { state, saveCreds } = store.authState();
  const s = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), browser: Browsers.windows('Caisse Panne Hôtel') });
  sock = s;
  s.ev.on('creds.update', saveCreds);
  s.ev.on('connection.update', async (u) => {
    if (sock !== s) return; // an older socket closing after a reconnect
    if (u.qr) {
      status = 'qr';
      qrImage = await QRCode.toDataURL(u.qr, { width: 300, margin: 1 });
      log('En attente du QR code : ouvrez Réglages dans l’app pour le scanner.');
      await report();
    }
    if (u.connection === 'open') {
      status = 'open';
      qrImage = null;
      log(`WhatsApp connecté : +${myNumber()}`);
      await report();
      void pull();
    }
    if (u.connection === 'close') {
      const code = (u.lastDisconnect?.error as any)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        log('Déconnecté depuis le téléphone : nouveau QR code.');
        store.clear();
      }
      status = 'connecting';
      await report();
      setTimeout(() => void connect(), code === DisconnectReason.loggedOut ? 500 : 3000);
    }
  });
}

/* ---------- sending ---------------------------------------------------- */

async function photoBytes(photo: string): Promise<{ image: Buffer; mimetype: string } | null> {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(photo);
  if (m) return { image: Buffer.from(m[2], 'base64'), mimetype: m[1] };
  if (/^https:\/\//.test(photo)) {
    const res = await fetch(photo, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) return { image: Buffer.from(await res.arrayBuffer()), mimetype: res.headers.get('content-type') ?? 'image/jpeg' };
  }
  return null;
}

async function send(to: string, text: string, photo: string | null) {
  const digits = to.replace(/\D/g, '');
  const [found] = (await sock!.onWhatsApp(digits)) ?? [];
  if (!found?.exists) throw new Error(`Le numéro +${digits} n'a pas WhatsApp.`);
  const media = photo ? await photoBytes(photo) : null;
  await sock!.sendMessage(found.jid, media ? { ...media, caption: text } : { text });
}

let pulling = false;
let again = false;

/** Sends everything queued; a wake-up during a pull runs one more round. */
async function pull() {
  if (pulling) {
    again = true;
    return;
  }
  pulling = true;
  try {
    do {
      again = false;
      const { messages, command } = await api<{ messages: any[]; command: string | null }>('gateway:pull');
      if (command === 'logout') {
        log('Changement de numéro demandé depuis l’app.');
        for (const m of messages) await api('gateway:ack', m.id, false, 'Numéro en cours de changement.');
        await sock?.logout().catch(() => {});
        return;
      }
      if (status !== 'open') {
        for (const m of messages) await api('gateway:ack', m.id, false, 'WhatsApp non connecté.');
        return;
      }
      for (const m of messages) {
        try {
          await send(m.to_phone, m.text, m.photo);
          await api('gateway:ack', m.id, true);
          log(`Envoyé à ${m.to_phone}`);
        } catch (err: any) {
          await api('gateway:ack', m.id, false, err?.message ?? String(err));
          log(`Échec vers ${m.to_phone} :`, err?.message ?? err);
        }
      }
      if (messages.length === 5) again = true;
    } while (again);
  } catch (err: any) {
    log('Récupération des messages échouée :', err.message);
  } finally {
    pulling = false;
  }
}

/* ---------- HTTP: health check and wake-up ----------------------------- */

http
  .createServer((req, res) => {
    if (req.url?.startsWith('/wake')) void pull();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(status === 'open' ? 'WhatsApp connecté' : `WhatsApp : ${status}`);
  })
  .listen(PORT, () => log(`Passerelle WhatsApp sur le port ${PORT}, app : ${APP_URL}`));

setInterval(() => {
  // the poll doubles as a heartbeat, so Réglages can tell when the gateway is down
  void report();
  if (status === 'open') void pull();
}, POLL_MS);
if (KEEPALIVE_URL) setInterval(() => void fetch(`${KEEPALIVE_URL}/health`).catch(() => {}), 10 * 60_000);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    for (let i = 0; i < 20 && store.pending(); i++) await store.flush();
    process.exit(0);
  });
}

await store.load();
await connect();
