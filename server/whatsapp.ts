import crypto from 'node:crypto';
import { all, get, run, transaction } from './db.js';
import { audit } from './services.js';
import {
  ROLE_DEPARTMENT,
  PROBLEM_KIND_LABELS,
  PANNE_CATEGORY_LABELS,
  tradeForPanne,
} from '../shared/types.js';
import type { UserRole } from '../shared/types.js';

/**
 * WhatsApp alerts to the people who have to act on a ticket, on top of the
 * in-app list. Provider chosen by WHATSAPP_PROVIDER:
 *  - "twilio": TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. +14155238886,
 *    the sandbox number); optional TWILIO_CONTENT_SID = an approved template with one variable {{1}}.
 *  - "meta": WhatsApp Cloud API — WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID; optional
 *    WHATSAPP_TEMPLATE (+ WHATSAPP_TEMPLATE_LANG, default "fr") = an approved template with one body variable {{1}}.
 *  - "web": free — sent from one ordinary WhatsApp number linked by QR code (Réglages).
 *    Messages are queued in whatsapp_outbox; the gateway process (server/whatsappGateway.ts,
 *    `npm run whatsapp`) pulls them through the gateway:* API calls below, authenticated with
 *    WHATSAPP_GATEWAY_SECRET. WHATSAPP_GATEWAY_URL (optional) is pinged to wake it up.
 * Without a provider (local dev) the message is only printed in the server console.
 *
 * WhatsApp only lets a business start a conversation with an approved template; free text
 * is accepted only within 24 h of the recipient writing to the number. Set a template for production.
 *
 * Alerts never fail the action that triggered them: errors are logged and audited.
 */

const TIMEOUT_MS = 8000;

interface Recipient { id: number; full_name: string; phone: string }

async function sendTwilio(to: string, text: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) throw new Error('Twilio non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM).');
  const form = new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}` });
  const contentSid = process.env.TWILIO_CONTENT_SID;
  if (contentSid) {
    form.set('ContentSid', contentSid);
    form.set('ContentVariables', JSON.stringify({ 1: oneLine(text) }));
  } else {
    form.set('Body', text);
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendMeta(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error('WhatsApp Cloud API non configurée (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).');
  const template = process.env.WHATSAPP_TEMPLATE;
  const message = template
    ? {
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'fr' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: oneLine(text) }] }],
        },
      }
    : { type: 'text', text: { body: text } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/^\+/, ''), ...message }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const viaGateway = () => (process.env.WHATSAPP_PROVIDER || '').toLowerCase() === 'web';

/** Queues the messages for the gateway, then pokes it so a sleeping one (free hosting) starts. */
async function enqueue(recipients: Recipient[], text: string, photo: string | null, panneId: number, actorId: number) {
  for (const r of recipients) {
    await run('INSERT INTO whatsapp_outbox (panne_id, recipient_name, to_phone, text, photo, actor_id) VALUES (?,?,?,?,?,?)', [
      panneId, r.full_name, r.phone, text, photo, actorId,
    ]);
  }
  await audit(actorId, 'whatsapp.queued', 'panne', panneId, { to: recipients.map((r) => r.full_name) });
  const url = process.env.WHATSAPP_GATEWAY_URL?.replace(/\/$/, '');
  if (url) await fetch(`${url}/wake`, { signal: AbortSignal.timeout(1500) }).catch(() => {});
}

/**
 * Sends a ticket photo (data URL or storage URL). The web gateway gets the bytes;
 * Twilio and Meta fetch the image themselves, so they need a public URL (Supabase storage).
 */
export async function sendWhatsAppImage(to: string, filePath: string, caption: string) {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  const isUrl = /^https?:\/\//.test(filePath);
  if ((provider === 'twilio' || provider === 'meta') && !isUrl) {
    throw new Error('Photo non envoyée : Twilio/Meta ont besoin du stockage Supabase (SUPABASE_URL).');
  }
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) throw new Error('Twilio non configuré.');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
      body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: caption, MediaUrl: filePath }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  if (provider === 'meta') {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/^\+/, ''), type: 'image', image: { link: filePath, caption } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  console.log(`[whatsapp:dry-run] → ${to} [photo] ${caption}\n`);
}

/** Template variables may not contain line breaks. */
function oneLine(text: string) {
  return text.replace(/\s*\n+\s*/g, ' · ').slice(0, 1000);
}

export async function sendWhatsApp(to: string, text: string) {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  if (provider === 'twilio') return sendTwilio(to, text);
  if (provider === 'meta') return sendMeta(to, text);
  console.log(`[whatsapp:dry-run] → ${to}\n${text}\n`);
}

/** One message per person: the photo with the text as its caption, or the text alone. */
async function deliver(recipients: Recipient[], text: string, photo: string | null, panneId: number, actorId: number) {
  if (!recipients.length) return;
  if (viaGateway()) return enqueue(recipients, text, photo, panneId, actorId);
  await Promise.all(
    recipients.map(async (r) => {
      try {
        if (photo) await sendWhatsAppImage(r.phone, photo, text);
        else await sendWhatsApp(r.phone, text);
        await audit(actorId, 'whatsapp.sent', 'panne', panneId, { to: r.full_name, phone: r.phone, photo: !!photo });
      } catch (err: any) {
        console.error(`WhatsApp to ${r.phone} failed:`, err?.message ?? err);
        await audit(actorId, 'whatsapp.failed', 'panne', panneId, { to: r.full_name, phone: r.phone, error: String(err?.message ?? err) });
      }
    })
  );
}

function placeLabel(p: any) {
  if (p.room_number) return `Chambre ${p.room_number}`;
  if (p.area_name) return p.area_name;
  return p.building_name ?? '—';
}

const KIND_EMOJI: Record<string, string> = { paint: '🎨', electricity: '⚡', clog: '🚿', water: '💧', wood: '🪵' };

/**
 * Kept short so it reads at a glance under the photo:
 *   🎨 *Peinture — Chambre 101*
 *   Mur écaillé près de la fenêtre
 *   Housekeeping · PANNE-20261102-0010
 */
function panneMessage(p: any, intro?: string) {
  const what = PROBLEM_KIND_LABELS[p.problem_kind] ?? PANNE_CATEGORY_LABELS[p.category as keyof typeof PANNE_CATEGORY_LABELS] ?? 'Problème';
  const urgent = p.priority === 'critical' || p.priority === 'high' ? '🚨 URGENT\n' : '';
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  return [
    intro,
    `${urgent}${KIND_EMOJI[p.problem_kind] ?? '🔧'} *${what} — ${placeLabel(p)}*`,
    String(p.description ?? p.title).slice(0, 500),
    [p.reported_by_name, p.ticket_number].filter(Boolean).join(' · '),
    appUrl,
  ].filter(Boolean).join('\n');
}

/**
 * Who hears about a new ticket: the person it was assigned to; otherwise the
 * department's team members whose métier matches it (a paint problem → the
 * painters), falling back to the whole team when no one has that métier.
 */
async function recipientsForNewPanne(p: any): Promise<Recipient[]> {
  if (p.assigned_to) {
    const u = await get<Recipient>("SELECT id, full_name, phone FROM users WHERE id = ? AND active = 1 AND phone IS NOT NULL AND phone <> ''", [p.assigned_to]);
    return u ? [u] : [];
  }
  const roles = (Object.entries(ROLE_DEPARTMENT) as [UserRole, string][]).filter(([, d]) => d === p.department).map(([r]) => r);
  if (!roles.length) return [];
  const team = await all<Recipient & { trade: string | null }>(
    `SELECT id, full_name, phone, trade FROM users
     WHERE active = 1 AND phone IS NOT NULL AND phone <> '' AND role IN (${roles.map(() => '?').join(',')})`,
    roles
  );
  const trade = tradeForPanne(p);
  const specialists = trade ? team.filter((u) => u.trade === trade) : [];
  return specialists.length ? specialists : team;
}

/** The new-ticket alert: its first photo with place and description as the caption. */
export async function notifyNewPanne(panne: any, photo: string | null, actorId: number) {
  try {
    const recipients = await recipientsForNewPanne(panne);
    if (recipients.length) await deliver(recipients, panneMessage(panne), photo, panne.id, actorId);
  } catch (err) {
    console.error('WhatsApp alert failed:', err);
  }
}

/** Extra photos the reporter adds after the first one follow the alert, with a short caption. */
export async function notifyNewPhoto(panne: any, filePath: string, actorId: number) {
  try {
    if (actorId !== panne.reported_by_user_id || !['open', 'assigned'].includes(panne.status)) return;
    const recipients = await recipientsForNewPanne(panne);
    await deliver(recipients, `📷 ${placeLabel(panne)} · ${panne.ticket_number}`, filePath, panne.id, actorId);
  } catch (err) {
    console.error('WhatsApp photo failed:', err);
  }
}

/** Tells the newly assigned person (not when they assigned it to themselves). */
export async function notifyAssigned(panne: any, previousAssignee: number | null, actorId: number) {
  try {
    if (!panne.assigned_to || panne.assigned_to === previousAssignee || panne.assigned_to === actorId) return;
    const u = await get<Recipient>("SELECT id, full_name, phone FROM users WHERE id = ? AND active = 1 AND phone IS NOT NULL AND phone <> ''", [panne.assigned_to]);
    if (!u) return;
    const photo = await get<{ file_path: string }>('SELECT file_path FROM panne_photos WHERE panne_id = ? ORDER BY id LIMIT 1', [panne.id]);
    await deliver([u], panneMessage(panne, '👷 Assigné à vous'), photo?.file_path ?? null, panne.id, actorId);
  } catch (err) {
    console.error('WhatsApp alert failed:', err);
  }
}

/* ---------- gateway API (server/whatsappGateway.ts calls these) ---------- */

const MAX_ATTEMPTS = 3;

/** True when `token` is WHATSAPP_GATEWAY_SECRET (constant-time compare). */
export function isGatewaySecret(token: string | null): boolean {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const gatewayHandlers: Record<string, (...args: any[]) => Promise<any>> = {
  /** Claims the next messages to send (and hands over any pending command). A claim older than 2 min is retried. */
  'gateway:pull': async () => {
    const messages = await transaction(async () => {
      const rows = await all<any>(
        `SELECT id, to_phone, text, photo FROM whatsapp_outbox
         WHERE status = 'pending' OR (status = 'sending' AND claimed_at < now_txt('-2 minutes'))
         ORDER BY id LIMIT 5 FOR UPDATE SKIP LOCKED`
      );
      for (const r of rows) await run("UPDATE whatsapp_outbox SET status = 'sending', claimed_at = now_txt(), attempts = attempts + 1 WHERE id = ?", [r.id]);
      return rows;
    });
    const gw = await get<{ command: string | null }>('SELECT command FROM whatsapp_gateway WHERE id = 1');
    if (gw?.command) await run('UPDATE whatsapp_gateway SET command = NULL WHERE id = 1');
    if (Math.random() < 0.02) {
      await run("DELETE FROM whatsapp_outbox WHERE status IN ('sent','failed') AND created_at < now_txt('-30 days')");
    }
    return { messages, command: gw?.command ?? null };
  },
  /** Result of one send. A failure goes back to the queue until MAX_ATTEMPTS. */
  'gateway:ack': async (id: number, ok: boolean, error?: string) => {
    const m = await get<any>('SELECT * FROM whatsapp_outbox WHERE id = ?', [id]);
    if (!m) return;
    const final = ok || m.attempts >= MAX_ATTEMPTS;
    await run(
      `UPDATE whatsapp_outbox SET status = ?, error = ?, sent_at = CASE WHEN ? THEN now_txt() ELSE sent_at END WHERE id = ?`,
      [ok ? 'sent' : final ? 'failed' : 'pending', ok ? null : String(error ?? '').slice(0, 500), ok, id]
    );
    if (final) {
      await audit(m.actor_id, ok ? 'whatsapp.sent' : 'whatsapp.failed', 'panne', m.panne_id, {
        to: m.recipient_name, phone: m.to_phone, photo: !!m.photo, ...(ok ? {} : { error }),
      });
    }
  },
  /** The saved WhatsApp session, as key → JSON text. */
  'gateway:stateLoad': async () => Object.fromEntries((await all<{ key: string; value: string }>('SELECT key, value FROM whatsapp_auth')).map((r) => [r.key, r.value])),
  /** Session changes: value null deletes the key; `reset` wipes everything first (new number). */
  'gateway:stateSave': async (changes: Record<string, string | null>, reset = false) => {
    await transaction(async () => {
      if (reset) await run('DELETE FROM whatsapp_auth');
      const entries = Object.entries(changes ?? {});
      const dels = entries.filter(([, v]) => v == null).map(([k]) => k);
      const sets = entries.filter(([, v]) => v != null) as [string, string][];
      if (dels.length) await run(`DELETE FROM whatsapp_auth WHERE key IN (${dels.map(() => '?').join(',')})`, dels);
      for (let i = 0; i < sets.length; i += 500) {
        const chunk = sets.slice(i, i + 500);
        await run(
          `INSERT INTO whatsapp_auth (key, value) VALUES ${chunk.map(() => '(?, ?)').join(', ')}
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING 1`,
          chunk.flat()
        );
      }
    });
  },
  /** Connection state for Réglages: 'connecting' | 'qr' (with the image to scan) | 'open' | 'logged_out'. */
  'gateway:status': async (status: string, phone: string | null, qrImage: string | null) => {
    await run('UPDATE whatsapp_gateway SET status = ?, phone = ?, qr_image = ?, updated_at = now_txt() WHERE id = 1', [
      String(status).slice(0, 20), phone, qrImage,
    ]);
  },
};

/** For Réglages. A gateway silent for 3 minutes is shown as offline (it reports at least every minute). */
export async function gatewayStatus() {
  const gw = await get<any>(
    "SELECT status, phone, qr_image, command, updated_at, updated_at < now_txt('-3 minutes') AS stale FROM whatsapp_gateway WHERE id = 1"
  );
  const queue = await get<{ pending: number; failed: number }>(
    "SELECT COUNT(*) FILTER (WHERE status IN ('pending','sending')) AS pending, COUNT(*) FILTER (WHERE status = 'failed' AND created_at > now_txt('-7 days')) AS failed FROM whatsapp_outbox"
  );
  return {
    enabled: viaGateway(),
    status: !gw || gw.stale ? 'offline' : gw.status,
    phone: gw?.phone ?? null,
    qr_image: gw && !gw.stale && gw.status === 'qr' ? gw.qr_image : null,
    logout_pending: gw?.command === 'logout',
    updated_at: gw?.updated_at ?? null,
    pending: Number(queue?.pending ?? 0),
    failed: Number(queue?.failed ?? 0),
  };
}
