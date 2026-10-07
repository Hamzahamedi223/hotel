import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { IconWrench, IconAlertCircle } from '../components/icons';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-canvas">
      <form onSubmit={submit} className="modal-panel w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center mb-3">
            <IconWrench size={24} />
          </div>
          <h1 className="text-lg font-bold text-ink">Caisse Panne Hôtel</h1>
          <p className="text-sm text-ink-soft mt-0.5">Livre de panne & maintenance hôtelière</p>
        </div>

        <label className="label">Utilisateur</label>
        <input autoFocus className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />

        <label className="label">Mot de passe</label>
        <input type="password" className="input mb-5" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-4 bg-red-500/10 rounded-lg px-3 py-2.5">
            <IconAlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        {import.meta.env.DEV && (
          <p className="text-[11px] text-ink-faint mt-5 text-center leading-relaxed">
            Comptes par défaut : <span className="font-mono">admin/admin123</span> · <span className="font-mono">manager/manager123</span> ·{' '}
            <span className="font-mono">reception/reception123</span> · <span className="font-mono">housekeeping/housekeeping123</span> ·{' '}
            <span className="font-mono">technicien/technicien123</span>
          </p>
        )}
      </form>
    </div>
  );
}
