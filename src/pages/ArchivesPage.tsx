import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast, ToastHost } from '../components/Toast';
import { dateOnly, dateTime } from '../lib/format';
import { hasPermission } from '../../shared/types';
import { IconFileText, IconSearch, IconDatabase } from '../components/icons';
import { useLiveTick } from '../lib/live';

/** Weekly PDF exports of finished tickets (server/archive.ts). */
export default function ArchivesPage() {
  const tick = useLiveTick();
  const user = useAuthStore((s) => s.user)!;
  const [data, setData] = useState<{ afterDays: number; pending: number; archives: any[] } | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = () => window.api.archives.list().then(setData).catch((e: any) => show(e.message, 'error'));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  async function download(a: any) {
    try {
      const { url, name } = await window.api.archives.download(a.id);
      // a data: URL (local dev) can't be opened directly; a blob link can
      const href = url.startsWith('data:') ? URL.createObjectURL(await (await fetch(url)).blob()) : url;
      const link = document.createElement('a');
      link.href = href;
      link.download = name;
      link.target = '_blank';
      link.rel = 'noopener';
      link.click();
    } catch (e: any) {
      show(e.message, 'error');
    }
  }

  async function runNow() {
    if (!data) return;
    if (!confirm(`Exporter en PDF puis supprimer de l'application les ${data.pending} ticket(s) terminé(s) depuis plus de ${data.afterDays} jours ?`)) return;
    setBusy(true);
    try {
      const r = await window.api.archives.run(user.id);
      show(r.archived ? `${r.archived} ticket(s) archivé(s).` : 'Rien à archiver.', 'success');
      load();
    } catch (e: any) {
      show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toUpperCase();
  const rows = (data?.archives ?? []).filter((a) => !q || String(a.ticket_numbers).toUpperCase().includes(q));

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <h1 className="text-xl font-bold mb-2">Archives</h1>
      <p className="text-sm text-ink-soft mb-4 max-w-2xl">
        Chaque lundi, les tickets <b>terminés</b> (réparés, clôturés ou annulés) sans activité depuis {data?.afterDays ?? 14} jours sont
        exportés dans un PDF — problème, lieu, personnes, dates, tout le suivi et les photos — puis supprimés de l'application.
        Les tickets non terminés ne sont jamais supprimés. Les {data?.afterDays ?? 14} derniers jours restent visibles dans le
        Livre de panne (filtre « Terminés »).
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Trouver un n° de ticket…" className="input !pl-9 !py-2 text-sm" />
        </div>
        {hasPermission(user.role, 'archive.run') && data && (
          <button onClick={runNow} disabled={busy || data.pending === 0} className="btn-secondary btn-sm">
            <IconDatabase size={14} /> {busy ? 'Archivage…' : `Archiver maintenant (${data.pending})`}
          </button>
        )}
      </div>

      <div className="table-wrap max-w-3xl">
        <table className="table">
          <thead>
            <tr>
              <th>Exporté le</th>
              <th>Tickets créés</th>
              <th>Tickets</th>
              <th>Taille</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {dateTime(a.created_at)}
                  {a.created_by_name && <div className="text-xs text-ink-faint">par {a.created_by_name}</div>}
                </td>
                <td className="text-sm">{dateOnly(a.period_from)} → {dateOnly(a.period_to)}</td>
                <td className="tabular-nums">{a.ticket_count}</td>
                <td className="text-xs text-ink-faint tabular-nums">{(a.size_bytes / 1024 / 1024).toFixed(1)} Mo</td>
                <td className="text-right">
                  <button onClick={() => download(a)} className="btn-primary btn-xs">
                    <IconFileText size={13} /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && rows.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-8">{q ? 'Aucune archive ne contient ce ticket.' : 'Aucune archive pour le moment.'}</p>
        )}
      </div>
      <ToastHost toast={toast} />
    </div>
  );
}
