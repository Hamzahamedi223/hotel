import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { IconPlus } from '../components/icons';
import { useLiveTick } from '../lib/live';
import { ROLE_LABELS, TRADE_LABELS } from '../../shared/types';

const ROLES = Object.entries(ROLE_LABELS);
const TRADES = Object.entries(TRADE_LABELS);
const EMPTY_FORM = { username: '', password: '', full_name: '', role: 'technician', phone: '', trade: '' };

/** Only maintenance technicians have a métier; other roles never send one. */
const withTrade = <T extends { role: string; trade: string }>(f: T): T => ({ ...f, trade: f.role === 'technician' ? f.trade : '' });

export default function UsersPage() {
  const tick = useLiveTick();
  const me = useAuthStore((s) => s.user)!;
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [newPw, setNewPw] = useState('');
  const [editFor, setEditFor] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', role: 'technician', phone: '', trade: '' });
  const { toast, show } = useToast();

  const load = () => window.api.users.list().then(setRows);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  async function create() {
    if (!form.username || !form.password || !form.full_name) return show('Tous les champs sont requis.', 'error');
    try {
      await window.api.users.create(me.id, withTrade(form));
      setShowNew(false);
      setForm(EMPTY_FORM);
      load();
      show('Utilisateur créé.', 'success');
    } catch (e: any) {
      show(e.message, 'error');
    }
  }

  async function saveEdit() {
    const input = withTrade({ ...editForm, username: editForm.username.trim(), full_name: editForm.full_name.trim() });
    if (!input.username || !input.full_name) return show('Nom et identifiant sont requis.', 'error');
    try {
      await window.api.users.update(me.id, editFor.id, input);
      if (editFor.id === me.id) useAuthStore.getState().patchUser(input as any);
      setEditFor(null);
      load();
      show('Utilisateur modifié.', 'success');
    } catch (e: any) {
      show(e.message, 'error');
    }
  }

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-xl font-bold">Utilisateurs</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">
          <IconPlus size={14} /> Nouvel utilisateur
        </button>
      </div>

      <div className="table-wrap max-w-3xl">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Identifiant</th>
              <th>Rôle</th>
              <th>WhatsApp</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name}</td>
                <td className="font-mono text-xs">{u.username}</td>
                <td>
                  {ROLES.find((r) => r[0] === u.role)?.[1] ?? u.role}
                  {u.trade && <div className="text-xs text-slate-500">{TRADE_LABELS[u.trade as keyof typeof TRADE_LABELS] ?? u.trade}</div>}
                </td>
                <td className="font-mono text-xs whitespace-nowrap">{u.phone ?? '—'}</td>
                <td>{u.active ? <span className="badge-success">Actif</span> : <span className="badge-neutral">Désactivé</span>}</td>
                <td className="text-right whitespace-nowrap">
                  <button
                    onClick={() => {
                      setEditFor(u);
                      setEditForm({ username: u.username, full_name: u.full_name, role: u.role, phone: u.phone ?? '', trade: u.trade ?? '' });
                    }}
                    className="btn-ghost btn-xs"
                  >
                    Modifier
                  </button>
                  <button onClick={() => { setResetFor(u); setNewPw(''); }} className="btn-ghost btn-xs">
                    Mot de passe
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await window.api.users.setActive(me.id, u.id, !u.active);
                        load();
                      } catch (e: any) {
                        show(e.message, 'error');
                      }
                    }}
                    className="btn-ghost btn-xs"
                    disabled={u.id === me.id}
                  >
                    {u.active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal
          title="Nouvel utilisateur"
          onClose={() => setShowNew(false)}
          width="w-96"
          footer={
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="btn-secondary btn-md flex-1">
                Annuler
              </button>
              <button onClick={create} className="btn-primary btn-md flex-1">
                Créer
              </button>
            </div>
          }
        >
          <label className="label">Nom complet</label>
          <input className="input mb-3" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <label className="label">Identifiant</label>
          <input className="input mb-3" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <label className="label">Mot de passe</label>
          <input type="password" className="input mb-3" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="label">Rôle</label>
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <ContactFields form={form} onChange={(patch) => setForm({ ...form, ...patch })} />
        </Modal>
      )}

      {editFor && (
        <Modal
          title={`Modifier — ${editFor.full_name}`}
          onClose={() => setEditFor(null)}
          width="w-96"
          footer={
            <div className="flex gap-2">
              <button onClick={() => setEditFor(null)} className="btn-secondary btn-md flex-1">
                Annuler
              </button>
              <button onClick={saveEdit} className="btn-primary btn-md flex-1">
                Enregistrer
              </button>
            </div>
          }
        >
          <label className="label">Nom complet</label>
          <input className="input mb-3" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          <label className="label">Identifiant</label>
          <input className="input mb-3" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
          <label className="label">Rôle</label>
          <select
            className="select"
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            disabled={editFor.id === me.id}
          >
            {ROLES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {editFor.id === me.id && (
            <p className="text-xs text-slate-500 mt-1">Vous ne pouvez pas changer votre propre rôle.</p>
          )}
          <ContactFields form={editForm} onChange={(patch) => setEditForm({ ...editForm, ...patch })} />
        </Modal>
      )}

      {resetFor && (
        <Modal
          title={`Réinitialiser — ${resetFor.full_name}`}
          onClose={() => setResetFor(null)}
          width="w-96"
          footer={
            <button
              onClick={async () => {
                try {
                  await window.api.users.resetPassword(me.id, resetFor.id, newPw);
                  setResetFor(null);
                  show('Mot de passe modifié.', 'success');
                } catch (e: any) {
                  show(e.message, 'error');
                }
              }}
              className="btn-primary btn-md w-full"
            >
              Enregistrer
            </button>
          }
        >
          <label className="label">Nouveau mot de passe</label>
          <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Modal>
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

/** WhatsApp number, and the métier for technicians: new tickets of that kind are sent to them. */
function ContactFields({ form, onChange }: { form: { role: string; phone: string; trade: string }; onChange: (patch: { phone?: string; trade?: string }) => void }) {
  return (
    <>
      <label className="label mt-3">Téléphone WhatsApp</label>
      <input
        type="tel"
        inputMode="tel"
        className="input"
        placeholder="+216 94 694 875"
        value={form.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
      />
      <p className="text-xs text-slate-500 mt-1">Format international. Laisser vide : pas de message WhatsApp.</p>
      {form.role === 'technician' && (
        <>
          <label className="label mt-3">Métier</label>
          <select className="select" value={form.trade} onChange={(e) => onChange({ trade: e.target.value })}>
            <option value="">Polyvalent</option>
            {TRADES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Reçoit sur WhatsApp les nouveaux tickets de son métier.</p>
        </>
      )}
    </>
  );
}
