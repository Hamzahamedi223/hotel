import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { EquipmentStatusBadge, PanneStatusBadge } from '../components/badges';
import { dateOnly, dateTime, daysBadge, money } from '../lib/format';
import { EQUIPMENT_CATEGORY_LABELS, EQUIPMENT_STATUS_LABELS } from '../../shared/types';
import { IconSearch, IconPlus, IconWrench, IconArrowLeft } from '../components/icons';
import { useLiveTick } from '../lib/live';
import { roomLabel } from '../components/RoomPicker';

export default function EquipmentPage() {
  const tick = useLiveTick();
  const user = useAuthStore((s) => s.user)!;
  const { buildings, rooms, areas, refresh: refreshLookups } = useLookups();
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setRows(await window.api.equipment.list({ query: query || undefined, status: statusFilter || undefined }));
  }, [query, statusFilter]);
  useEffect(() => {
    load();
  }, [load, tick]);
  useEffect(() => {
    if (!tick || !selected) return;
    window.api.equipment.get(selected.id).then((fresh) => fresh && setSelected(fresh)).catch(() => {});
    window.api.equipment.history(selected.id).then(setHistory).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const select = useCallback(async (e: any) => {
    setSelected(e);
    setHistory(await window.api.equipment.history(e.id));
  }, []);

  async function refreshAll() {
    await load();
    refreshLookups();
    if (selected) {
      const fresh = await window.api.equipment.get(selected.id);
      setSelected(fresh);
      setHistory(await window.api.equipment.history(selected.id));
    }
  }

  return (
    <div className="h-full flex min-h-0">
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] shrink-0 md:border-r border-line bg-surface flex-col min-h-0`}>
        <div className="p-3.5 border-b border-line shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h1 className="text-sm font-bold">Équipements ({rows.length})</h1>
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-xs">
              <IconPlus size={13} /> Ajouter
            </button>
          </div>
          <div className="relative mb-2">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code, nom…" className="input !pl-9 !py-2 text-sm" />
          </div>
          <select className="select !py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(EQUIPMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {rows.map((e) => (
            <button
              key={e.id}
              onClick={() => select(e)}
              className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors ${selected?.id === e.id ? 'bg-brand-600 text-white' : 'hover:bg-surface-alt'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs opacity-80">{e.code}</span>
                {selected?.id === e.id ? <span className="text-[11px]">{EQUIPMENT_STATUS_LABELS[e.status as keyof typeof EQUIPMENT_STATUS_LABELS]}</span> : <EquipmentStatusBadge status={e.status} />}
              </div>
              <div className="font-semibold text-sm truncate mt-0.5">{e.name}</div>
              <div className={`text-xs mt-0.5 ${selected?.id === e.id ? 'text-white/75' : 'text-ink-faint'}`}>
                {EQUIPMENT_CATEGORY_LABELS[e.category as keyof typeof EQUIPMENT_CATEGORY_LABELS] ?? e.category} · {e.room_number ? `Ch. ${e.room_number}` : e.area_name ?? e.building_name ?? '—'}
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink-faint text-center py-10">Aucun équipement.</p>}
        </div>
      </div>

      <div className={`${selected ? 'block' : 'hidden md:block'} flex-1 min-w-0 overflow-y-auto scrollbar-thin p-4 md:p-6`}>
        {!selected ? (
          <div className="empty-state h-full justify-center">
            <IconWrench size={28} className="text-ink-faint" />
            <p className="text-sm text-ink-soft">Sélectionnez un équipement.</p>
          </div>
        ) : (
          <div className="max-w-3xl">
            <button onClick={() => setSelected(null)} className="md:hidden btn-ghost btn-sm !px-2 -ml-2 mb-2">
              <IconArrowLeft size={16} /> Équipements
            </button>
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  <EquipmentStatusBadge status={selected.status} />
                </div>
                <p className="text-sm text-ink-soft mt-1">
                  {selected.code} · {EQUIPMENT_CATEGORY_LABELS[selected.category as keyof typeof EQUIPMENT_CATEGORY_LABELS]} · {selected.brand ?? ''} {selected.model ?? ''}
                </p>
              </div>
              <button onClick={() => { setEditing(selected); setShowForm(true); }} className="btn-secondary btn-sm">Modifier</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Stat label="Emplacement" value={selected.room_number ? `Chambre ${selected.room_number}` : selected.area_name ?? selected.building_name ?? '—'} />
              <Stat label="N° série" value={selected.serial_number ?? '—'} />
              <Stat label="Installation" value={dateOnly(selected.install_date)} />
              <div className="card p-3">
                <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1">Garantie</div>
                <div className="font-bold text-sm">{dateOnly(selected.warranty_expiry)}</div>
                {(() => {
                  const b = daysBadge(selected.warranty_expiry);
                  return b ? <div className={`text-xs mt-0.5 ${b.overdue ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{b.overdue ? 'Expirée' : `Active — ${b.text}`}</div> : null;
                })()}
              </div>
            </div>

            {selected.notes && <p className="text-sm text-ink-soft mb-5">{selected.notes}</p>}

            {history && (
              <>
                <Section title={`Historique des pannes (${history.pannes.length})`}>
                  {history.pannes.slice(0, 10).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-line last:border-0">
                      <span className="font-mono text-xs">{p.ticket_number}</span>
                      <span className="flex-1 truncate">{p.title}</span>
                      <PanneStatusBadge status={p.status} />
                      <span className="text-xs text-ink-faint">{dateTime(p.created_at)}</span>
                    </div>
                  ))}
                  {history.pannes.length === 0 && <p className="text-sm text-ink-faint">Aucune panne.</p>}
                </Section>
                <Section title={`Maintenance préventive (${history.maintenance.length})`}>
                  {history.maintenance.slice(0, 10).map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-line last:border-0">
                      <span className="flex-1 truncate">{m.schedule_title}</span>
                      <span className="text-xs text-ink-faint">{dateTime(m.completed_at)}</span>
                      <span className="font-semibold tabular-nums">{money(m.cost)}</span>
                    </div>
                  ))}
                  {history.maintenance.length === 0 && <p className="text-sm text-ink-faint">Aucun entretien.</p>}
                </Section>
              </>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <EquipmentForm
          editing={editing}
          buildings={buildings}
          rooms={rooms}
          areas={areas}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await refreshAll();
            show('Équipement enregistré.', 'success');
          }}
          show={show}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1">{label}</div>
      <div className="font-bold text-sm truncate">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-bold text-sm mb-2">{title}</h3>
      <div className="card p-3">{children}</div>
    </div>
  );
}

function EquipmentForm({ editing, buildings, rooms, areas, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [locType, setLocType] = useState<'room' | 'area' | 'building' | 'none'>(editing?.room_id ? 'room' : editing?.area_id ? 'area' : editing?.building_id ? 'building' : 'none');
  const [f, setF] = useState<any>(
    editing ?? {
      name: '', category: 'other', room_id: '', area_id: '', building_id: '',
      brand: '', model: '', serial_number: '', install_date: '', warranty_expiry: '', status: 'operational', notes: '',
    }
  );
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.name) return show('Le nom est requis.', 'error');
    setBusy(true);
    try {
      const payload = {
        ...f,
        room_id: locType === 'room' && f.room_id ? Number(f.room_id) : null,
        area_id: locType === 'area' && f.area_id ? Number(f.area_id) : null,
        building_id: locType === 'building' && f.building_id ? Number(f.building_id) : null,
        install_date: f.install_date || null,
        warranty_expiry: f.warranty_expiry || null,
      };
      if (editing) await window.api.equipment.update(user.id, editing.id, payload);
      else await window.api.equipment.create(user.id, payload);
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Modifier ${editing.code}` : 'Nouvel équipement'}
      onClose={onClose}
      width="w-[600px]"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary btn-md flex-1">Annuler</button>
          <button disabled={busy} onClick={submit} className="btn-primary btn-md flex-1">Enregistrer</button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2"><label className="label">Nom</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div>
          <label className="label">Catégorie</label>
          <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(EQUIPMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Emplacement</label>
          <select className="select" value={locType} onChange={(e) => setLocType(e.target.value as any)}>
            <option value="none">— Aucun —</option>
            <option value="room">Chambre</option>
            <option value="area">Zone commune</option>
            <option value="building">Bâtiment</option>
          </select>
        </div>
        {locType === 'room' && (
          <div>
            <label className="label">Chambre</label>
            <select className="select" value={f.room_id ?? ''} onChange={(e) => set('room_id', e.target.value)}>
              <option value="">—</option>
              {rooms.map((r: any) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
            </select>
          </div>
        )}
        {locType === 'area' && (
          <div>
            <label className="label">Zone</label>
            <select className="select" value={f.area_id ?? ''} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">—</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        {locType === 'building' && (
          <div>
            <label className="label">Bâtiment</label>
            <select className="select" value={f.building_id ?? ''} onChange={(e) => set('building_id', e.target.value)}>
              <option value="">—</option>
              {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Marque</label><input className="input" value={f.brand ?? ''} onChange={(e) => set('brand', e.target.value)} /></div>
        <div><label className="label">Modèle</label><input className="input" value={f.model ?? ''} onChange={(e) => set('model', e.target.value)} /></div>
        <div><label className="label">N° série</label><input className="input" value={f.serial_number ?? ''} onChange={(e) => set('serial_number', e.target.value)} /></div>
        <div><label className="label">Date d'installation</label><input type="date" className="input" value={f.install_date ?? ''} onChange={(e) => set('install_date', e.target.value)} /></div>
        <div><label className="label">Fin de garantie</label><input type="date" className="input" value={f.warranty_expiry ?? ''} onChange={(e) => set('warranty_expiry', e.target.value)} /></div>
      </div>
      <label className="label">Notes</label>
      <textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
    </Modal>
  );
}
