let currencyCode = 'TND';

export function setCurrency(code: string) {
  currencyCode = code || 'TND';
}

export function money(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `${v.toFixed(3)} ${currencyCode}`;
}

export function money0(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `${v.toFixed(0)} ${currencyCode}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-TN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-TN', { dateStyle: 'medium' });
}

/** value for <input type="datetime-local"> */
export function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function daysBadge(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Math.round((t - Date.now()) / 86400000);
  if (diff < 0) return { text: `il y a ${-diff} j`, overdue: true };
  return { text: `dans ${diff} j`, overdue: diff <= 3 };
}

/** Converts an absolute local filesystem path (from the main process) to a src usable in <img>. */
export function fileUrl(p: string | null | undefined): string {
  if (!p) return '';
  if (/^(data:|https?:)/.test(p)) return p;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}
