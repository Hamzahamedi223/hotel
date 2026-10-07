import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { IconPlus, IconEdit } from '../components/icons';
import { useLiveTick } from '../lib/live';

export default function ContractorsPage() {
  const tick = useLiveTick();
  const user = useAuthStore((s) => s.user)!;
  const refreshLookups = useLookups((s) => s.refresh);
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(() => window.api.contractors.list().then(setRows), []);
  useEffect(() => {
    load();
  }, [load, tick]);

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-xl font-bold">Prestataires externes</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><IconPlus size={14} /> Prestataire</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Entreprise</th><th>Contact</th><th>Téléphone</th><th>Service</th><th>Tarif</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.company}</td>
                <td>{c.contact_name ?? '—'}</td>
                <td>{c.phone ?? '—'}</td>
                <td>{c.service_type ?? '—'}</td>
                <td>{c.rate != null ? c.rate : '—'}</td>
                <td>{c.active ? <span className="badge-success">Actif</span> : <span className="badge-neutral">Inactif</span>}</td>
                <td className="text-right"><button onClick={() => { setEditing(c); setShowForm(true); }} className="btn-ghost btn-xs !px-1.5"><IconEdit size={13} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-ink-faint">Aucun prestataire.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ContractorForm
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await load();
            refreshLookups();
            show('Prestataire enregistré.', 'success');
          }}
          show={show}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function ContractorForm({ editing, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [f, setF] = useState<any>(
    editing ?? { company: '', contact_name: '', phone: '', email: '', service_type: '', contract_info: '', rate: '', notes: '', active: true }
  );
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.company) return show("Le nom de l'entreprise est requis.", 'error');
    try {
      await window.api.contractors.save(user.id, { ...f, rate: f.rate === '' ? null : Number(f.rate), active: f.active ? 1 : 0 });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title={editing ? 'Modifier le prestataire' : 'Nouveau prestataire'} onClose={onClose} width="w-[520px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Entreprise</label><input className="input" value={f.company} onChange={(e) => set('company', e.target.value)} /></div>
        <div><label className="label">Contact</label><input className="input" value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></div>
        <div><label className="label">Téléphone</label><input className="input" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">Type de service</label><input className="input" value={f.service_type ?? ''} onChange={(e) => set('service_type', e.target.value)} placeholder="Ascenseurs, Climatisation…" /></div>
        <div><label className="label">Tarif</label><input type="number" className="input" value={f.rate ?? ''} onChange={(e) => set('rate', e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm pb-2.5">
          <input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked)} /> Actif
        </label>
      </div>
      <label className="label mt-1">Informations contrat</label>
      <textarea className="input mb-3" rows={2} value={f.contract_info ?? ''} onChange={(e) => set('contract_info', e.target.value)} />
      <label className="label">Notes</label>
      <textarea className="input" rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
    </Modal>
  );
}
