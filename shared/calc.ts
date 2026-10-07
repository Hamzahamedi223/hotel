export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Adds `value` of the given unit to an ISO date, returning an ISO date (YYYY-MM-DD). */
export function addToDate(fromIso: string, unit: 'days' | 'weeks' | 'months', value: number): string {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) return fromIso;
  if (unit === 'days') d.setDate(d.getDate() + value);
  else if (unit === 'weeks') d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d.toISOString().slice(0, 10);
}

/** Minutes between two ISO datetimes, or null if either is missing/invalid. */
export function minutesBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Math.round((e - s) / 60000);
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}
