import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { RoomStatusBadge } from '../components/badges';
import { ROOM_STATUS_LABELS } from '../../shared/types';
import { IconPlus, IconEdit, IconAlertTriangle } from '../components/icons';
import { useLiveTick } from '../lib/live';

type Tab = 'rooms' | 'buildings' | 'areas';

const AREA_TYPES: [string, string][] = [
  ['corridor', 'Couloir'], ['kitchen', 'Cuisine'], ['restaurant', 'Restaurant'], ['laundry', 'Buanderie'],
  ['reception', 'Réception'], ['offices', 'Bureaux'], ['technical_room', 'Local technique'], ['elevator', 'Ascenseur'],
  ['exterior', 'Extérieur'], ['pool', 'Piscine'], ['spa', 'Spa'], ['parking', 'Parking'], ['bathroom', 'Sanitaires'], ['other', 'Autre'],
];

export default function HotelPage() {
  const tick = useLiveTick();
  const user = useAuthStore((s) => s.user)!;
  const refreshLookups = useLookups((s) => s.refresh);
  const [tab, setTab] = useState<Tab>('rooms');
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [roomModal, setRoomModal] = useState<any | null | 'new'>(null);
  const [areaModal, setAreaModal] = useState<any | null | 'new'>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setRooms(await window.api.rooms.list());
    setBuildings(await window.api.buildings.list());
    setAreas(await window.api.areas.list());
  }, []);
  useEffect(() => {
    load();
  }, [load, tick]);

  async function refreshAll() {
    await load();
    refreshLookups();
  }

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-surface-alt rounded-lg p-1 max-w-full overflow-x-auto scrollbar-thin">
          {(['rooms', 'buildings', 'areas'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${tab === t ? 'bg-surface shadow-xs text-ink' : 'text-ink-soft'}`}>
              {t === 'rooms' ? 'Chambres' : t === 'buildings' ? 'Bâtiments' : 'Zones communes'}
            </button>
          ))}
        </div>
        {tab === 'rooms' && <button onClick={() => setRoomModal('new')} className="btn-primary btn-sm"><IconPlus size={14} /> Chambre</button>}
        {tab === 'areas' && <button onClick={() => setAreaModal('new')} className="btn-primary btn-sm"><IconPlus size={14} /> Zone</button>}
      </div>

      {tab === 'rooms' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Chambre</th><th>Bâtiment</th><th>Étage</th><th>Type</th><th>Statut</th><th>Pannes ouvertes</th><th></th></tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.room_number}</td>
                  <td>{r.building_name ?? '—'}</td>
                  <td>{r.floor ?? '—'}</td>
                  <td>{r.room_type ?? '—'}</td>
                  <td><RoomStatusBadge status={r.status} /></td>
                  <td>{r.open_pannes > 0 ? <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><IconAlertTriangle size={13} />{r.open_pannes}</span> : '—'}</td>
                  <td className="text-right"><button onClick={() => setRoomModal(r)} className="btn-ghost btn-xs"><IconEdit size={13} /></button></td>
                </tr>
              ))}
              {rooms.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-ink-faint">Aucune chambre.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'buildings' && (
        <BuildingsList
          rows={buildings}
          onSave={async (row: any) => {
            try {
              await window.api.buildings.save(user.id, row);
              await refreshAll();
              show('Enregistré.', 'success');
            } catch (e: any) {
              show(e.message ?? 'Erreur', 'error');
            }
          }}
          onDelete={async (row: any) => {
            try {
              await window.api.buildings.delete(user.id, row.id);
              await refreshAll();
              show('Bâtiment supprimé.', 'success');
            } catch (e: any) {
              show(e.message ?? 'Erreur', 'error');
            }
          }}
        />
      )}

      {tab === 'areas' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nom</th><th>Bâtiment</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.name}</td>
                  <td>{a.building_name ?? '—'}</td>
                  <td>{AREA_TYPES.find(([k]) => k === a.area_type)?.[1] ?? a.area_type}</td>
                  <td className="text-right"><button onClick={() => setAreaModal(a)} className="btn-ghost btn-xs"><IconEdit size={13} /></button></td>
                </tr>
              ))}
              {areas.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-ink-faint">Aucune zone.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {roomModal && (
        <RoomModal
          editing={roomModal === 'new' ? null : roomModal}
          buildings={buildings}
          onClose={() => setRoomModal(null)}
          onSaved={async () => {
            setRoomModal(null);
            await refreshAll();
            show('Chambre enregistrée.', 'success');
          }}
          show={show}
        />
      )}
      {areaModal && (
        <AreaModal
          editing={areaModal === 'new' ? null : areaModal}
          buildings={buildings}
          onClose={() => setAreaModal(null)}
          onSaved={async () => {
            setAreaModal(null);
            await refreshAll();
            show('Zone enregistrée.', 'success');
          }}
          show={show}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function RoomModal({ editing, buildings, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [f, setF] = useState<any>(
    editing ?? { building_id: buildings[0]?.id ?? null, floor: '', room_number: '', room_type: '', status: 'available', notes: '' }
  );
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.room_number) return show('Le numéro de chambre est requis.', 'error');
    try {
      await window.api.rooms.save(user.id, { ...f, building_id: f.building_id ? Number(f.building_id) : null });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title={editing ? `Modifier ${editing.room_number}` : 'Nouvelle chambre'} onClose={onClose} width="w-[480px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Bâtiment</label>
          <select className="select" value={f.building_id ?? ''} onChange={(e) => set('building_id', e.target.value)}>
            {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div><label className="label">Étage</label><input className="input" value={f.floor ?? ''} onChange={(e) => set('floor', e.target.value)} /></div>
        <div><label className="label">Numéro</label><input className="input" value={f.room_number} onChange={(e) => set('room_number', e.target.value)} /></div>
        <div><label className="label">Type</label><input className="input" value={f.room_type ?? ''} onChange={(e) => set('room_type', e.target.value)} placeholder="Double, Suite…" /></div>
        <div className="col-span-2">
          <label className="label">Statut</label>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <label className="label">Notes</label>
      <textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
    </Modal>
  );
}

function AreaModal({ editing, buildings, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [f, setF] = useState<any>(editing ?? { building_id: buildings[0]?.id ?? null, name: '', area_type: 'other', notes: '' });
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.name) return show('Le nom est requis.', 'error');
    try {
      await window.api.areas.save(user.id, { ...f, building_id: f.building_id ? Number(f.building_id) : null });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title={editing ? `Modifier ${editing.name}` : 'Nouvelle zone'} onClose={onClose} width="w-[440px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <label className="label">Nom</label>
      <input className="input mb-3" value={f.name} onChange={(e) => set('name', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Bâtiment</label>
          <select className="select" value={f.building_id ?? ''} onChange={(e) => set('building_id', e.target.value)}>
            {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="select" value={f.area_type} onChange={(e) => set('area_type', e.target.value)}>
            {AREA_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function BuildingsList({ rows, onSave, onDelete }: { rows: any[]; onSave: (row: any) => void; onDelete: (row: any) => void }) {
  const [draft, setDraft] = useState({ name: '', active: 1 });
  return (
    <div className="table-wrap max-w-xl">
      <table className="table">
        <thead><tr><th>Nom</th><th className="text-center">Actif</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="text-center">
                <input type="checkbox" checked={r.active === 1} onChange={(e) => onSave({ ...r, active: e.target.checked ? 1 : 0 })} />
              </td>
              <td className="text-right">
                <button onClick={() => { if (confirm(`Supprimer « ${r.name} » ?`)) onDelete(r); }} className="btn-ghost btn-xs !text-red-600 dark:!text-red-400">
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td><input className="input !py-1.5 text-sm" placeholder="Nouveau bâtiment…" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
            <td></td>
            <td className="text-right">
              <button
                onClick={() => {
                  if (!draft.name) return;
                  onSave(draft);
                  setDraft({ name: '', active: 1 });
                }}
                className="btn-secondary btn-xs"
              >
                Ajouter
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
