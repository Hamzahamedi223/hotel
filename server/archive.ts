import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import jpeg from 'jpeg-js';
import { all, get, run, transaction } from './db.js';
import { audit, panneDetail, settingsMap } from './services.js';
import { readPhoto, deletePhotoFiles, storeArchivePdf, deleteArchivePdf } from './photos.js';
import {
  PANNE_STATUS_LABELS, DEPARTMENT_LABELS, ROLE_LABELS, PANNE_CATEGORY_LABELS, PANNE_PRIORITY_LABELS, REPORTER_ROLE_LABELS,
} from '../shared/types.js';

/**
 * Weekly archive: finished tickets (résolu / clôturé / annulé) with no
 * activity for ARCHIVE_AFTER_DAYS are written to one PDF — summary list, then
 * every ticket with its thread and small photos — which is stored, and only
 * then are those tickets (and their photo files) deleted. Unfinished tickets
 * are never archived, however old.
 */
export const ARCHIVE_AFTER_DAYS = 14;
const FINISHED = ['resolved', 'closed', 'cancelled'];
const BATCH = 120; // tickets per PDF, keeps one run well inside the function time limit
const ELIGIBLE = `status IN ('resolved','closed','cancelled') AND updated_at < now_txt(interval '-${ARCHIVE_AFTER_DAYS} days')`;

export async function eligibleCount(): Promise<number> {
  return (await get<{ c: number }>(`SELECT COUNT(*) c FROM pannes WHERE ${ELIGIBLE}`))!.c;
}

/** Archives everything eligible, one PDF per batch, until done or out of time. */
export async function runArchive(actorId: number | null, budgetMs = 40_000) {
  const started = Date.now();
  const made: { id: number; tickets: number }[] = [];
  while (Date.now() - started < budgetMs) {
    const one = await archiveBatch(actorId);
    if (!one) break;
    made.push(one);
  }
  return { archives: made, archived: made.reduce((s, a) => s + a.tickets, 0), remaining: await eligibleCount() };
}

async function archiveBatch(actorId: number | null): Promise<{ id: number; tickets: number } | null> {
  const ids = (await all<{ id: number }>(`SELECT id FROM pannes WHERE ${ELIGIBLE} ORDER BY id LIMIT ${BATCH}`)).map((r) => r.id);
  if (ids.length === 0) return null;

  const details: any[] = [];
  for (const id of ids) details.push(await panneDetail(id));
  const settings = await settingsMap();
  const pdf = await buildArchivePdf(details, settings);

  const dates = details.map((d) => String(d.panne.created_at)).sort();
  const period_from = dates[0]?.slice(0, 10) ?? null;
  const period_to = details.map((d) => String(d.panne.updated_at)).sort().at(-1)?.slice(0, 10) ?? null;
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const stored = await storeArchivePdf(name, pdf);

  const marks = ids.map(() => '?').join(',');
  try {
    const archiveId = await transaction(async () => {
      // a ticket reopened or commented while the PDF was being built is no longer eligible: keep everything, retry next run
      const still = await all(`SELECT id FROM pannes WHERE id IN (${marks}) AND ${ELIGIBLE} FOR UPDATE`, ids);
      if (still.length !== ids.length) throw new RetryLater();
      await run(`UPDATE inventory_movements SET panne_id = NULL WHERE panne_id IN (${marks})`, ids); // stock history stays
      for (const t of ['panne_comments', 'panne_photos', 'panne_interventions', 'panne_parts']) {
        await run(`DELETE FROM ${t} WHERE panne_id IN (${marks})`, ids);
      }
      await run(`DELETE FROM pannes WHERE id IN (${marks})`, ids);
      const { lastInsertRowid } = await run(
        `INSERT INTO archives (created_by, period_from, period_to, ticket_count, ticket_numbers, size_bytes, file_name, pdf_base64)
         VALUES (?,?,?,?,?,?,?,?)`,
        [actorId, period_from, period_to, ids.length, details.map((d) => d.panne.ticket_number).join(' '), pdf.length,
          stored, stored ? null : pdf.toString('base64')]
      );
      await audit(actorId, 'archive.create', 'archive', lastInsertRowid, { tickets: ids.length });
      return lastInsertRowid;
    });
    // tickets are gone; now their photo files (best effort — an orphan file is harmless)
    await deletePhotoFiles(details.flatMap((d) => d.photos.map((ph: any) => ph.file_path)));
    return { id: archiveId, tickets: ids.length };
  } catch (err) {
    if (stored) await deleteArchivePdf(stored);
    if (err instanceof RetryLater) return null;
    throw err;
  }
}

class RetryLater extends Error {}

/* ---------- PDF ----------------------------------------------------------- */

const TZ = 'Africa/Tunis';
function fmt(v: unknown, withTime = true): string {
  if (!v) return '—';
  const s = String(v);
  // stored as UTC, either 'YYYY-MM-DD HH:MM:SS' or ISO
  const d = new Date(/[TZ]/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('fr-FR', { timeZone: TZ, dateStyle: 'short', ...(withTime ? { timeStyle: 'short' } : {}) });
}

// The built-in PDF fonts only cover Western European characters (WinAnsi).
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
function clean(v: unknown): string {
  return Array.from(String(v ?? ''))
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (ch === '\n' || ch === '\t') return ch;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) return ch;
      if (ch === '→') return '->';
      return '?';
    })
    .join('');
}

/** Shrinks a JPEG to a thumbnail so a week of photos stays a few MB. */
function thumbnail(bytes: Buffer, max = 360): Buffer | null {
  try {
    const src = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
    const scale = Math.min(1, max / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const out = Buffer.alloc(w * h * 4);
    const step = 1 / scale;
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * step), y1 = Math.min(src.height, Math.max(y0 + 1, Math.floor((y + 1) * step)));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * step), x1 = Math.min(src.width, Math.max(x0 + 1, Math.floor((x + 1) * step)));
        let r = 0, g = 0, b = 0, n = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const i = (sy * src.width + sx) * 4;
            r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
          }
        }
        const o = (y * w + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
      }
    }
    return Buffer.from(jpeg.encode({ data: out, width: w, height: h }, 60).data);
  } catch {
    return null;
  }
}

export async function buildArchivePdf(details: any[], settings: Record<string, string>): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: 'Archive des tickets', Author: clean(settings.company_name || 'Caisse Panne Hôtel') } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

  const W = doc.page.width - 80;
  const bottom = () => doc.page.height - 50;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };
  const where = (p: any) =>
    p.room_number ? `Chambre ${p.room_number}${p.room_building_name ? ' — ' + p.room_building_name : ''}` : p.area_name || p.building_name || '—';

  // cover + summary
  doc.font('Helvetica-Bold').fontSize(18).text(clean(settings.company_name || 'Caisse Panne Hôtel'));
  doc.font('Helvetica').fontSize(13).fillColor('#444').text('Archive des tickets terminés');
  doc.moveDown(0.4).fontSize(10)
    .text(clean(`${details.length} ticket(s) · créés du ${fmt(details.map((d) => d.panne.created_at).sort()[0], false)} · exporté le ${fmt(new Date().toISOString())}`));
  doc.text(clean(`Tickets résolus, clôturés ou annulés sans activité depuis ${ARCHIVE_AFTER_DAYS} jours. Ils ont été supprimés de l'application après cet export.`));
  doc.fillColor('black').moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(9);
  const cols = [0, 105, 265, 400, 462];
  const head = ['N°', 'Problème', 'Lieu', 'Service', 'Statut'];
  const row = (vals: string[], bold = false) => {
    ensure(14);
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    vals.forEach((v, i) => {
      // one line per ticket: cut what doesn't fit (pdfkit would wrap onto the next row)
      const width = (cols[i + 1] ?? W) - cols[i] - 6;
      let text = clean(v);
      if (doc.widthOfString(text) > width) {
        while (text.length > 1 && doc.widthOfString(text + '…') > width) text = text.slice(0, -1);
        text += '…';
      }
      doc.text(text, 40 + cols[i], y, { lineBreak: false });
    });
    doc.x = 40;
    doc.y = y + 13;
  };
  row(head, true);
  doc.moveTo(40, doc.y - 2).lineTo(40 + W, doc.y - 2).strokeColor('#bbb').stroke();
  for (const d of details) {
    const p = d.panne;
    row([p.ticket_number, p.title, where(p), DEPARTMENT_LABELS[p.department as keyof typeof DEPARTMENT_LABELS] ?? '', PANNE_STATUS_LABELS[p.status as keyof typeof PANNE_STATUS_LABELS] ?? p.status]);
  }

  // one block per ticket
  for (const d of details) {
    const p = d.panne;
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text(clean(`${p.ticket_number} — ${p.title}`), { width: W });
    doc.font('Helvetica').fontSize(9).fillColor('#444')
      .text(clean(`${PANNE_STATUS_LABELS[p.status as keyof typeof PANNE_STATUS_LABELS] ?? p.status} · ${DEPARTMENT_LABELS[p.department as keyof typeof DEPARTMENT_LABELS] ?? ''} · ${PANNE_CATEGORY_LABELS[p.category as keyof typeof PANNE_CATEGORY_LABELS] ?? p.category} · priorité ${PANNE_PRIORITY_LABELS[p.priority as keyof typeof PANNE_PRIORITY_LABELS] ?? p.priority}`));
    doc.fillColor('black').moveDown(0.5);

    const line = (label: string, value: string) => {
      ensure(13);
      doc.font('Helvetica-Bold').fontSize(9).text(clean(label + ' : '), { continued: true }).font('Helvetica').text(clean(value || '—'));
    };
    line('Lieu', where(p) + (p.equipment_name ? ` · ${p.equipment_name}` : ''));
    line('Signalé par', `${p.reported_by_name ?? '—'}${p.reported_by_role ? ` (${REPORTER_ROLE_LABELS[p.reported_by_role] ?? p.reported_by_role})` : ''}`);
    line('Assigné à', [p.assigned_to_name, p.contractor_name].filter(Boolean).join(' · ') || '—');
    line('Créé', fmt(p.created_at));
    if (p.resolved_at) line('Résolu', fmt(p.resolved_at));
    if (p.closed_at) line('Clôturé', fmt(p.closed_at));
    if (p.description) {
      doc.moveDown(0.4);
      ensure(30);
      doc.font('Helvetica-Bold').fontSize(9).text('Description');
      doc.font('Helvetica').text(clean(p.description), { width: W });
    }

    if (d.comments.length) {
      doc.moveDown(0.5);
      ensure(30);
      doc.font('Helvetica-Bold').fontSize(10).text('Suivi & réponses');
      for (const c of d.comments) {
        ensure(26);
        const who = `${c.user_name ?? '—'}${c.user_role ? ` (${ROLE_LABELS[c.user_role as keyof typeof ROLE_LABELS] ?? c.user_role})` : ''}`;
        const status = c.status ? ` — ${PANNE_STATUS_LABELS[c.status as keyof typeof PANNE_STATUS_LABELS] ?? c.status}` : '';
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#444').text(clean(`${fmt(c.created_at)} · ${who}${status}`));
        doc.fillColor('black');
        if (c.body) doc.font('Helvetica').fontSize(9).text(clean(c.body), { width: W });
        doc.moveDown(0.25);
      }
    }

    // full-mode details, only when there are any
    if (d.interventions.length || d.parts.length || p.total_cost) {
      doc.moveDown(0.5);
      ensure(30);
      doc.font('Helvetica-Bold').fontSize(10).text('Travaux');
      doc.font('Helvetica').fontSize(9);
      if (p.diagnosis) doc.text(clean(`Diagnostic : ${p.diagnosis}`), { width: W });
      for (const i of d.interventions) doc.text(clean(`${fmt(i.started_at)} · ${i.technician_name ?? '—'} : ${i.description ?? ''}${i.result ? ` (${i.result})` : ''}`), { width: W });
      for (const pp of d.parts) doc.text(clean(`Pièce : ${pp.label} × ${pp.qty} = ${pp.amount}`), { width: W });
      if (p.total_cost) doc.text(clean(`Coût total : ${p.total_cost} ${settings.currency ?? ''}`));
    }

    if (d.photos.length) {
      doc.moveDown(0.6);
      const h = 120;
      ensure(h + 20);
      doc.font('Helvetica-Bold').fontSize(10).text('Photos');
      let x = 40;
      let y = doc.y + 4;
      for (const ph of d.photos.slice(0, 8)) {
        const raw = await readPhoto(ph.file_path);
        const img = raw && thumbnail(raw);
        if (!img) continue;
        if (x + 160 > 40 + W) { x = 40; y += h + 8; }
        if (y + h > bottom()) { doc.addPage(); x = 40; y = doc.y; }
        doc.image(img, x, y, { fit: [160, h] });
        x += 168;
      }
      doc.x = 40;
      doc.y = y + h + 8;
    }
  }

  // page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // else writing in the footer area adds a blank page
    doc.font('Helvetica').fontSize(8).fillColor('#888')
      .text(`${i + 1} / ${range.count}`, 40, doc.page.height - 30, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
