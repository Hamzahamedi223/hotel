import { useEffect, useState } from 'react';
import { dateOnly } from '../lib/format';
import { PANNE_STATUS_LABELS } from '../../shared/types';
import type { View } from '../components/Drawer';
import { PanneStatusBadge, PannePriorityBadge } from '../components/badges';
import {
  IconClipboardList,
  IconArrowRight,
  IconClock,
  IconAlertTriangle,
  IconWrench,
  IconBuilding,
  IconCalendar,
  IconRefresh,
} from '../components/icons';
import { useLiveTick } from '../lib/live';

export default function DashboardPage({ onNavigate }: { onNavigate: (v: View) => void }) {
  const tick = useLiveTick();
  const [data, setData] = useState<any>(null);

  const load = () => window.api.dashboard.summary().then(setData);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (!data) return <div className="p-6 text-sm text-ink-faint">Chargement…</div>;

  const sm: Record<string, number> = data.statusMap;
  const statusOrder = ['open', 'assigned', 'diagnosis', 'waiting_parts', 'in_repair', 'testing', 'resolved', 'closed'];

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
        <h1 className="hidden md:block text-xl font-bold">Tableau de bord</h1>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost btn-sm">
            <IconRefresh size={15} /> Actualiser
          </button>
          <button onClick={() => onNavigate('pannes')} className="btn-primary btn-sm">
            <IconClipboardList size={15} /> Livre de panne
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Kpi icon={IconClipboardList} label="Ouverts" value={String(data.openCount)} />
        <Kpi icon={IconAlertTriangle} label="Critiques" value={String(data.criticalOpen)} tone={data.criticalOpen > 0 ? 'danger' : undefined} />
        <Kpi icon={IconAlertTriangle} label="Élevés" value={String(data.highOpen)} tone={data.highOpen > 0 ? 'warn' : undefined} />
        <Kpi icon={IconWrench} label="En cours" value={String(data.inProgress)} />
        <Kpi icon={IconClock} label="Résolus aujourd'hui" value={String(data.resolvedToday)} />
        <Kpi icon={IconBuilding} label="Chambres HS" value={String(data.roomsOutOfService)} tone={data.roomsOutOfService > 0 ? 'warn' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-4">
          <h2 className="font-bold text-sm mb-3">Répartition des tickets</h2>
          <div className="space-y-1.5">
            {statusOrder
              .filter((s) => (sm[s] ?? 0) > 0)
              .map((s) => (
                <div key={s} className="flex items-center justify-between text-sm py-1">
                  <span className="text-ink-soft">{PANNE_STATUS_LABELS[s as keyof typeof PANNE_STATUS_LABELS]}</span>
                  <span className="font-bold tabular-nums">{sm[s]}</span>
                </div>
              ))}
            {statusOrder.every((s) => !(sm[s] ?? 0)) && <p className="text-sm text-ink-faint">Aucun ticket.</p>}
          </div>
        </section>

        <section className="card p-4 lg:col-span-2">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <IconArrowRight size={15} className="text-brand-600" /> Tickets prioritaires ({data.recentTickets.length})
          </h2>
          {data.recentTickets.length === 0 && <p className="text-sm text-ink-faint">Aucun ticket ouvert.</p>}
          {data.recentTickets.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-sm">
              <PannePriorityBadge priority={r.priority} />
              <span className="flex-1 min-w-0 truncate">{r.title}</span>
              <span className="text-xs text-ink-soft">{r.room_number ? `Ch. ${r.room_number}` : r.area_name || r.building_name || '—'}</span>
              <PanneStatusBadge status={r.status} />
            </div>
          ))}
        </section>

        <section className="card p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <IconCalendar size={15} /> Maintenance à venir ({data.dueSoonMaintenance.length})
          </h2>
          {data.dueSoonMaintenance.length === 0 && <p className="text-sm text-ink-faint">Rien de prévu.</p>}
          {data.dueSoonMaintenance.map((m: any) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-sm">
              <span className={`badge-dot ${m.next_due_date < new Date().toISOString().slice(0, 10) ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className="flex-1 min-w-0 truncate">{m.title}</span>
              <span className="text-xs text-ink-faint">{dateOnly(m.next_due_date)}</span>
            </div>
          ))}
          {data.overdueMaintenance > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">{data.overdueMaintenance} échéance(s) en retard.</p>
          )}
        </section>

        <section className="card p-4 lg:col-span-2">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
            <IconAlertTriangle size={15} /> Pannes récurrentes (90 j)
          </h2>
          {data.recurring.length === 0 && <p className="text-sm text-ink-faint">Aucune chambre en panne répétée.</p>}
          {data.recurring.map((r: any) => (
            <div key={r.room_id} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-sm">
              <span className="font-mono text-xs">Chambre {r.room_number}</span>
              <span className="flex-1" />
              <span className="font-bold tabular-nums">{r.c} pannes</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: (p: any) => JSX.Element;
  label: string;
  value: string;
  tone?: 'warn' | 'danger';
}) {
  const toneClass = tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-ink';
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-ink-faint mb-1.5">
        <Icon size={13} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-extrabold tabular-nums truncate ${toneClass}`}>{value}</div>
    </div>
  );
}
