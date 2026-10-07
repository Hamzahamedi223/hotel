import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import { useToast, ToastHost } from '../components/Toast';
import Modal from '../components/Modal';
import { money, dateTime } from '../lib/format';
import { buildDailyLogHtml } from '../lib/print';
import { PANNE_CATEGORY_LABELS } from '../../shared/types';
import { IconPrinter, IconPlus } from '../components/icons';
import { useLiveTick } from '../lib/live';

type Tab = 'frequency' | 'rooms' | 'equipment' | 'costs' | 'technicians' | 'daily';

const TABS: { key: Tab; label: string }[] = [
  { key: 'frequency', label: 'Fréquence' },
  { key: 'rooms', label: 'Chambres' },
  { key: 'equipment', label: 'Équipements' },
  { key: 'costs', label: 'Coûts' },
  { key: 'technicians', label: 'Techniciens' },
  { key: 'daily', label: 'Journal quotidien' },
];

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const tick = useLiveTick();
  const user = useAuthStore((s) => s.user)!;
  const [tab, setTab] = useState<Tab>('frequency');
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyRows, setDailyRows] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [showHandover, setShowHandover] = useState(false);
  const { toast, show } = useToast();

  const fromIso = `${from} 00:00:00`;
  const toIso = `${to} 23:59:59`;

  useEffect(() => {
    if (tab === 'frequency') window.api.reports.frequency(user.id, fromIso, toIso).then(setFrequency);
    if (tab === 'rooms') window.api.reports.rooms(user.id, fromIso, toIso).then(setRooms);
    if (tab === 'equipment') window.api.reports.equipment(user.id, fromIso, toIso).then(setEquipment);
    if (tab === 'costs') window.api.reports.costs(user.id, fromIso, toIso).then(setCosts);
    if (tab === 'technicians') window.api.reports.technicians(user.id, fromIso, toIso).then(setTechnicians);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to, tick]);

  useEffect(() => {
    if (tab === 'daily') {
      window.api.reports.dailyLog(date).then(setDailyRows);
      window.api.handovers.list(10).then(setHandovers);
    }
  }, [tab, date, tick]);

  async function printDaily() {
    const settings = useLookups.getState().settings;
    await window.api.print.document(buildDailyLogHtml(dailyRows, date, settings));
  }

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 bg-surface-alt rounded-lg p-1 max-w-full overflow-x-auto scrollbar-thin">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${tab === t.key ? 'bg-surface shadow-xs text-ink' : 'text-ink-soft'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'daily' ? (
          <div className="flex items-center gap-2">
            <input type="date" className="input !py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-ink-faint text-sm">→</span>
            <input type="date" className="input !py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" className="input !py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
            <button onClick={printDaily} className="btn-secondary btn-sm"><IconPrinter size={14} /> Imprimer</button>
          </div>
        )}
      </div>

      {tab === 'frequency' && (
        <Table head={['Catégorie', 'Nombre']} rows={frequency.map((f) => [PANNE_CATEGORY_LABELS[f.category as keyof typeof PANNE_CATEGORY_LABELS] ?? f.category, f.c])} />
      )}
      {tab === 'rooms' && (
        <Table head={['Chambre', 'Bâtiment', 'Nombre de pannes']} rows={rooms.map((r) => [r.room_number, r.building_name ?? '—', r.c])} />
      )}
      {tab === 'equipment' && (
        <Table head={['Équipement', 'Code', 'Nombre de pannes', 'Coût total']} rows={equipment.map((e) => [e.name, e.code, e.c, money(e.total_cost)])} />
      )}
      {tab === 'costs' && costs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Pièces" value={money(costs.totals.parts)} />
            <StatCard label="Main d'œuvre" value={money(costs.totals.labor)} />
            <StatCard label="Prestataires" value={money(costs.totals.contractor)} />
            <StatCard label="Total" value={money(costs.totals.total)} highlight />
          </div>
          <Table
            head={['Catégorie', 'Pièces', 'Main d\'œuvre', 'Prestataire', 'Total']}
            rows={costs.byCategory.map((c: any) => [
              PANNE_CATEGORY_LABELS[c.category as keyof typeof PANNE_CATEGORY_LABELS] ?? c.category,
              money(c.parts), money(c.labor), money(c.contractor), money(c.total),
            ])}
          />
        </>
      )}
      {tab === 'technicians' && (
        <Table
          head={['Technicien', 'Tickets assignés', 'Résolus', 'Temps moyen de résolution']}
          rows={technicians.map((t) => [t.full_name, t.total_assigned, t.resolved_count, t.avg_resolution_hours != null ? `${Math.round(t.avg_resolution_hours)} h` : '—'])}
        />
      )}
      {tab === 'daily' && (
        <>
          <div className="table-wrap mb-5">
            <table className="table">
              <thead><tr><th>Heure</th><th>Emplacement</th><th>Problème</th><th>Technicien</th><th>Statut</th></tr></thead>
              <tbody>
                {dailyRows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-ink-soft whitespace-nowrap">{dateTime(r.created_at).split(' ').pop()}</td>
                    <td>{r.room_number ? `Ch. ${r.room_number}` : r.area_name || r.building_name || '—'}</td>
                    <td>{r.title}</td>
                    <td>{r.assigned_to_name ?? r.contractor_name ?? '—'}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
                {dailyRows.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-ink-faint">Aucun ticket ce jour.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">Consignes de passation</h2>
            <button onClick={() => setShowHandover(true)} className="btn-secondary btn-xs"><IconPlus size={13} /> Ajouter</button>
          </div>
          <div className="card divide-y divide-line">
            {handovers.map((h) => (
              <div key={h.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold">{h.user_name ?? '—'} · {h.shift}</span>
                  <span className="text-xs text-ink-faint">{dateTime(h.created_at)}</span>
                </div>
                <p className="text-ink-soft whitespace-pre-wrap">{h.notes}</p>
              </div>
            ))}
            {handovers.length === 0 && <p className="text-sm text-ink-faint text-center py-6">Aucune consigne.</p>}
          </div>
        </>
      )}

      {showHandover && (
        <HandoverModal
          onClose={() => setShowHandover(false)}
          onSaved={async () => {
            setShowHandover(false);
            setHandovers(await window.api.handovers.list(10));
            show('Consigne enregistrée.', 'success');
          }}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'tabular-nums' : ''}>{c}</td>)}</tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={head.length} className="text-center py-6 text-ink-faint">Aucune donnée.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1">{label}</div>
      <div className={`text-lg font-extrabold tabular-nums ${highlight ? 'text-brand-600 dark:text-brand-400' : ''}`}>{value}</div>
    </div>
  );
}

function HandoverModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const [shift, setShift] = useState('day');
  const [notes, setNotes] = useState('');
  async function submit() {
    if (!notes.trim()) return;
    await window.api.handovers.add(user.id, { shift, notes });
    onSaved();
  }
  return (
    <Modal title="Nouvelle consigne de passation" onClose={onClose} width="w-[480px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <label className="label">Poste</label>
      <select className="select mb-3" value={shift} onChange={(e) => setShift(e.target.value)}>
        <option value="morning">Matin</option>
        <option value="afternoon">Après-midi</option>
        <option value="night">Nuit</option>
        <option value="day">Journée</option>
      </select>
      <label className="label">Consignes</label>
      <textarea className="input" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce qui reste à faire pour la prochaine équipe…" />
    </Modal>
  );
}
