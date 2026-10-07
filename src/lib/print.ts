import { money, dateTime } from './format';
import { PANNE_CATEGORY_LABELS, PANNE_PRIORITY_LABELS, PANNE_STATUS_LABELS } from '../../shared/types';
import type { PanneCategory, PannePriority, PanneStatus } from '../../shared/types';

function shell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    * { font-family: 'Segoe UI', system-ui, sans-serif; }
    body { margin: 32px; color: #111; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 20px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
    th { background: #f4f4f4; font-size: 11px; text-transform: uppercase; }
    .right { text-align: right; }
    .muted { color: #666; }
    .totals td { border: none; padding: 3px 8px; }
    .totals .grand { font-weight: 700; font-size: 15px; border-top: 2px solid #333; }
    .row { display: flex; justify-content: space-between; gap: 40px; }
    .sign { margin-top: 60px; display: flex; justify-content: space-between; }
    .sign div { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #555; }
  </style></head><body>${body}
  <script>window.onload = () => setTimeout(() => window.print(), 150);</script>
  </body></html>`;
}

function header(settings: Record<string, string>): string {
  return `<div class="row">
    <div>
      <h1>${settings.company_name || 'Caisse Panne Hôtel'}</h1>
      <div class="muted">${settings.company_address || ''}</div>
      <div class="muted">${settings.company_phone || ''} ${settings.company_email ? ' · ' + settings.company_email : ''}</div>
    </div>
  </div>`;
}

export function buildInterventionReportHtml(detail: any, settings: Record<string, string>): string {
  const p = detail.panne;
  const interventionRows = detail.interventions
    .map(
      (i: any) =>
        `<tr><td>${i.technician_name ?? '—'}</td><td>${dateTime(i.started_at)}</td><td>${dateTime(i.finished_at)}</td><td>${i.description ?? ''}</td><td>${i.result ?? ''}</td></tr>`
    )
    .join('');
  const partRows = detail.parts
    .map((pp: any) => `<tr><td>${pp.label}</td><td class="right">${pp.qty}</td><td class="right">${money(pp.unit_cost)}</td><td class="right">${money(pp.amount)}</td></tr>`)
    .join('');
  const location = p.room_number ? `Chambre ${p.room_number}${p.room_building_name ? ' — ' + p.room_building_name : ''}` : p.area_name || p.building_name || '—';
  const body = `
    ${header(settings)}
    <h1 style="margin-top:18px">Rapport d'intervention ${p.ticket_number}</h1>
    <div class="muted">${dateTime(p.created_at)} · ${PANNE_STATUS_LABELS[p.status as PanneStatus] ?? p.status}</div>
    <div class="row" style="margin-top:12px">
      <div>
        <h2>Ticket</h2>
        <div><strong>${p.title}</strong></div>
        <div class="muted">${PANNE_CATEGORY_LABELS[p.category as PanneCategory] ?? p.category} · ${PANNE_PRIORITY_LABELS[p.priority as PannePriority] ?? p.priority}</div>
        <div class="muted">${p.description ?? ''}</div>
      </div>
      <div>
        <h2>Localisation</h2>
        <div>${location}</div>
        <div class="muted">${p.equipment_name ?? ''}</div>
      </div>
      <div>
        <h2>Responsable</h2>
        <div>${p.assigned_to_name ?? p.contractor_name ?? '—'}</div>
      </div>
    </div>
    ${p.diagnosis ? `<h2>Diagnostic</h2><div>${p.diagnosis}</div>` : ''}
    ${p.cause ? `<h2>Cause</h2><div>${p.cause}</div>` : ''}
    ${p.recommended_action ? `<h2>Action recommandée</h2><div>${p.recommended_action}</div>` : ''}
    ${interventionRows ? `<h2>Interventions</h2><table><thead><tr><th>Technicien</th><th>Début</th><th>Fin</th><th>Description</th><th>Résultat</th></tr></thead><tbody>${interventionRows}</tbody></table>` : ''}
    ${partRows ? `<h2>Pièces utilisées</h2><table><thead><tr><th>Désignation</th><th class="right">Qté</th><th class="right">PU</th><th class="right">Montant</th></tr></thead><tbody>${partRows}</tbody></table>` : ''}
    <table class="totals" style="width:40%; margin-left:auto">
      <tr><td>Pièces</td><td class="right">${money(p.parts_cost)}</td></tr>
      <tr><td>Main d'œuvre</td><td class="right">${money(p.labor_cost)}</td></tr>
      <tr><td>Prestataire</td><td class="right">${money(p.contractor_cost)}</td></tr>
      <tr class="grand"><td>Total</td><td class="right">${money(p.total_cost)}</td></tr>
    </table>
    <div class="sign"><div>Technicien</div><div>Responsable maintenance</div></div>
  `;
  return shell(`Rapport ${p.ticket_number}`, body);
}

export function buildDailyLogHtml(rows: any[], date: string, settings: Record<string, string>): string {
  const trs = rows
    .map(
      (r: any) => `<tr>
        <td>${dateTime(r.created_at).split(' ').pop()}</td>
        <td>${r.room_number ? 'Ch. ' + r.room_number : r.area_name || r.building_name || '—'}</td>
        <td>${r.title}</td>
        <td>${r.assigned_to_name ?? r.contractor_name ?? '—'}</td>
        <td>${PANNE_STATUS_LABELS[r.status as PanneStatus] ?? r.status}</td>
      </tr>`
    )
    .join('');
  const body = `
    ${header(settings)}
    <h1 style="margin-top:18px">Journal de maintenance — ${date}</h1>
    <table>
      <thead><tr><th>Heure</th><th>Emplacement</th><th>Problème</th><th>Technicien</th><th>Statut</th></tr></thead>
      <tbody>${trs || '<tr><td colspan="5" class="muted">Aucun ticket ce jour.</td></tr>'}</tbody>
    </table>
  `;
  return shell(`Journal ${date}`, body);
}
