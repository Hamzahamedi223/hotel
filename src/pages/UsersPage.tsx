import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { IconPlus } from '../components/icons';

const ROLES: [string, string][] = [
  ['admin', 'Administrateur'],
  ['manager', 'Responsable maintenance'],
  ['reception', 'Réception'],
  ['housekeeping', 'Housekeeping'],
  ['technician', 'Technicien'],
];

export default function UsersPage() {
  const me = useAuthStore((s) => s.user)!;
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'technician' });
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [newPw, setNewPw] = useState('');
  const { toast, show } = useToast();

  const load = () => window.api.users.list().then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.username || !form.password || !form.full_name) return show('Tous les champs sont requis.', 'error');
    try {
      await window.api.users.create(me.id, form);
      setShowNew(false);
      setForm({ username: '', password: '', full_name: '', role: 'technician' });
      load();
      show('Utilisateur créé.', 'success');
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
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name}</td>
                <td className="font-mono text-xs">{u.username}</td>
                <td>{ROLES.find((r) => r[0] === u.role)?.[1] ?? u.role}</td>
                <td>{u.active ? <span className="badge-success">Actif</span> : <span className="badge-neutral">Désactivé</span>}</td>
                <td className="text-right whitespace-nowrap">
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
