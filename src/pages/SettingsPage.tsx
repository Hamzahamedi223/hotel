import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import { useToast, ToastHost } from '../components/Toast';
import { IconDatabase } from '../components/icons';

const COMPANY_FIELDS: [string, string][] = [
  ["Nom de l'hôtel", 'company_name'],
  ['Adresse', 'company_address'],
  ['Téléphone', 'company_phone'],
  ['Email', 'company_email'],
  ['Devise', 'currency'],
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)!;
  const refreshLookups = useLookups((s) => s.refresh);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { toast, show } = useToast();

  async function loadAll() {
    setSettings(await window.api.settings.get());
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function saveSetting(key: string, value: string) {
    await window.api.settings.set(user.id, key, value);
    show('Enregistré.', 'success');
    refreshLookups();
  }

  async function backup() {
    try {
      await window.api.backup.create(user.id);
      show('Sauvegarde téléchargée.', 'success');
    } catch (e: any) {
      show(e.message, 'error');
    }
  }
  async function restore() {
    try {
      if (await window.api.backup.restore(user.id)) location.reload();
    } catch (e: any) {
      show(e.message, 'error');
    }
  }

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <h1 className="text-xl font-bold mb-5">Réglages</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <Panel title="Hôtel">
          {COMPANY_FIELDS.map(([label, key]) => (
            <SettingRow key={key} label={label} value={settings[key] ?? ''} onSave={(v) => saveSetting(key, v)} />
          ))}
        </Panel>

        <Panel title="Sauvegarde & restauration">
          <p className="text-sm text-ink-soft mb-3">
            Les données sont en ligne et partagées par tous les appareils. Téléchargez régulièrement une sauvegarde (fichier .json) et gardez-la en lieu sûr.
          </p>
          <div className="flex gap-2">
            <button onClick={backup} className="btn-secondary btn-md flex-1">
              <IconDatabase size={15} /> Sauvegarder
            </button>
            <button onClick={restore} className="btn-danger-soft btn-md flex-1">
              Restaurer
            </button>
          </div>
        </Panel>
      </div>
      <ToastHost toast={toast} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="font-bold text-sm mb-3">{title}</h2>
      {children}
    </section>
  );
}

function SettingRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="mb-2.5">
      <label className="label">{label}</label>
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </div>
  );
}
