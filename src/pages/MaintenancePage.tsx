import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { dateOnly, dateTime } from '../lib/format';
import { IconPlus, IconCalendar, IconCheck, IconEdit, IconTrash } from '../components/icons';

type Tab = 'upcoming' | 'overdue' | 'all';

const FREQ_LABELS: Record<string, string> = { days: 'jour(s)', weeks: 'semaine(s)', months: 'mois' };

export default function MaintenancePage() {
  const user = useAuthStore((s) => s.user)!;
  const { equipment, areas, buildings, technicians } = useLookups();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [completing, setCompleting] = useState<any | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setRows(await window.api.maintenanceSchedules.list({ scope: tab }));
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-surface-alt rounded-lg p-1 max-w-full overflow-x-auto scrollbar-thin">
          {(['upcoming', 'overdue', 'all'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${tab === t ? 'bg-surface shadow-xs text-ink' : 'text-ink-soft'}`}>
              {t === 'upcoming' ? 'À venir (30j)' : t === 'overdue' ? 'En retard' : 'Toutes'}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><IconPlus size={14} /> Échéance</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rows.map((s) => {
          const overdue = s.next_due_date < today;
          return (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-sm">{s.title}</h3>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(s); setShowForm(true); }} className="btn-ghost btn-xs !px-1.5"><IconEdit size={13} /></button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Supprimer l'échéance « ${s.title} » ?`)) return;
                      await window.api.maintenanceSchedules.delete(user.id, s.id);
                      load();
                    }}
                    className="btn-ghost btn-xs !px-1.5 !text-red-600 dark:!text-red-400"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-ink-faint mb-2">
                {s.equipment_name ?? s.area_name ?? s.building_name ?? 'Général'} · Tous les {s.frequency_value} {FREQ_LABELS[s.frequency_type]}
                {s.assigned_to_name ? ` · ${s.assigned_to_name}` : ''}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold flex items-center gap-1.5 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}>
                  <IconCalendar size={14} /> {dateOnly(s.next_due_date)} {overdue && '(en retard)'}
                </span>
                <button onClick={() => setCompleting(s)} className="btn-success btn-xs"><IconCheck size={13} /> Compléter</button>
              </div>
              {s.last_completed_at && <p className="text-[11px] text-ink-faint mt-1.5">Dernière : {dateTime(s.last_completed_at)}</p>}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-ink-faint col-span-2 text-center py-10">Aucune échéance.</p>}
      </div>

      {showForm && (
        <ScheduleForm
          editing={editing}
          equipment={equipment}
          areas={areas}
          buildings={buildings}
          technicians={technicians}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); show('Échéance enregistrée.', 'success'); }}
          show={show}
        />
      )}
      {completing && (
        <CompleteModal
          schedule={completing}
          onClose={() => setCompleting(null)}
          onSaved={() => { setCompleting(null); load(); show('Entretien complété.', 'success'); }}
          show={show}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function ScheduleForm({ editing, equipment, areas, buildings, technicians, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [target, setTarget] = useState<'equipment' | 'area' | 'building'>(editing?.equipment_id ? 'equipment' : editing?.area_id ? 'area' : 'building');
  const [f, setF] = useState<any>(
    editing ?? {
      title: '', equipment_id: '', area_id: '', building_id: '', frequency_type: 'months', frequency_value: 3,
      checklist: '', assigned_to: '', next_due_date: new Date().toISOString().slice(0, 10), notes: '', active: true,
    }
  );
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function submit() {
    if (!f.title) return show('Le titre est requis.', 'error');
    try {
      await window.api.maintenanceSchedules.save(user.id, editing?.id ?? null, {
        title: f.title,
        equipment_id: target === 'equipment' && f.equipment_id ? Number(f.equipment_id) : null,
        area_id: target === 'area' && f.area_id ? Number(f.area_id) : null,
        building_id: target === 'building' && f.building_id ? Number(f.building_id) : null,
        frequency_type: f.frequency_type,
        frequency_value: Number(f.frequency_value) || 1,
        checklist: f.checklist ? f.checklist.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
        assigned_to: f.assigned_to ? Number(f.assigned_to) : null,
        next_due_date: f.next_due_date,
        notes: f.notes || null,
        active: f.active !== false,
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  const checklistText = Array.isArray(f.checklist) ? f.checklist.join('\n') : typeof f.checklist === 'string' && f.checklist.startsWith('[') ? JSON.parse(f.checklist).join('\n') : f.checklist ?? '';

  return (
    <Modal title={editing ? 'Modifier l\'échéance' : 'Nouvelle échéance'} onClose={onClose} width="w-[560px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <label className="label">Titre</label>
      <input className="input mb-3" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex : Entretien trimestriel climatisation" />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Cible</label>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value as any)}>
            <option value="equipment">Équipement</option>
            <option value="area">Zone</option>
            <option value="building">Bâtiment</option>
          </select>
        </div>
        {target === 'equipment' && (
          <div>
            <label className="label">Équipement</label>
            <select className="select" value={f.equipment_id ?? ''} onChange={(e) => set('equipment_id', e.target.value)}>
              <option value="">—</option>
              {equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
        )}
        {target === 'area' && (
          <div>
            <label className="label">Zone</label>
            <select className="select" value={f.area_id ?? ''} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">—</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        {target === 'building' && (
          <div>
            <label className="label">Bâtiment</label>
            <select className="select" value={f.building_id ?? ''} onChange={(e) => set('building_id', e.target.value)}>
              <option value="">—</option>
              {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div><label className="label">Fréquence</label><input type="number" className="input" value={f.frequency_value} onChange={(e) => set('frequency_value', e.target.value)} /></div>
        <div>
          <label className="label">Unité</label>
          <select className="select" value={f.frequency_type} onChange={(e) => set('frequency_type', e.target.value)}>
            <option value="days">Jours</option>
            <option value="weeks">Semaines</option>
            <option value="months">Mois</option>
          </select>
        </div>
        <div><label className="label">Prochaine échéance</label><input type="date" className="input" value={f.next_due_date} onChange={(e) => set('next_due_date', e.target.value)} /></div>
      </div>

      <label className="label">Technicien assigné</label>
      <select className="select mb-3" value={f.assigned_to ?? ''} onChange={(e) => set('assigned_to', e.target.value)}>
        <option value="">— Aucun —</option>
        {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
      </select>

      <label className="label">Liste de contrôle (une ligne par point)</label>
      <textarea className="input" rows={4} value={checklistText} onChange={(e) => set('checklist', e.target.value)} placeholder={'Nettoyer filtres\nVérifier compresseur\nContrôler température'} />
    </Modal>
  );
}

function CompleteModal({ schedule, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  let items: string[] = [];
  try {
    items = schedule.checklist ? JSON.parse(schedule.checklist) : [];
  } catch {
    items = [];
  }
  const [results, setResults] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i, 'ok'])));
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('0');

  async function submit() {
    try {
      await window.api.maintenanceSchedules.complete(user.id, schedule.id, { checklist_results: results, notes: notes || undefined, cost: Number(cost) || 0 });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  return (
    <Modal title={`Compléter — ${schedule.title}`} onClose={onClose} width="w-[520px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer & planifier la suivante</button>}>
      {items.length > 0 && (
        <div className="mb-3 space-y-2">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex-1">{item}</span>
              <select className="select !py-1 !w-32 text-xs" value={results[item] ?? 'ok'} onChange={(e) => setResults((r) => ({ ...r, [item]: e.target.value }))}>
                <option value="ok">OK</option>
                <option value="problem">Problème</option>
                <option value="not_checked">Non vérifié</option>
              </select>
            </div>
          ))}
        </div>
      )}
      <label className="label">Coût</label>
      <input type="number" className="input mb-3" value={cost} onChange={(e) => setCost(e.target.value)} />
      <label className="label">Notes</label>
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p className="field-hint mt-2">
        La prochaine échéance sera calculée automatiquement à +{schedule.frequency_value} {FREQ_LABELS[schedule.frequency_type]} à partir d'aujourd'hui.
      </p>
    </Modal>
  );
}
