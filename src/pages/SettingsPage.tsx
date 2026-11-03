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
    setSettings((s) => ({ ...s, [key]: value }));
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

        <Panel title="Affichage">
          <p className="text-sm text-ink-soft mb-3">
            <b>Mode simple</b> : signaler un problème, l'équipe répond. <b>Mode complet</b> : ajoute équipements, maintenance préventive, stock,
            prestataires, rapports, journal d'audit, et diagnostic / pièces / coûts dans les tickets. Les données sont conservées dans les deux cas.
          </p>
          <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
            {([['simple', 'Mode simple'], ['full', 'Mode complet']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => saveSetting('ui_mode', k)}
                className={`flex-1 text-sm font-semibold py-2 rounded-md ${(settings.ui_mode === 'full' ? 'full' : 'simple') === k ? 'bg-surface shadow-xs' : 'text-ink-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <WhatsAppPanel show={show} />

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

/**
 * The number the WhatsApp alerts are sent from: its state as the gateway last
 * reported it, and the QR code to scan while none is linked. Refreshed every
 * few seconds while open, because the QR code changes every ~20 s.
 */
function WhatsAppPanel({ show }: { show: (msg: string, kind?: any) => void }) {
  const [wa, setWa] = useState<any | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => window.api.whatsapp.status().then((s: any) => alive && setWa(s)).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!wa?.enabled) return null;

  async function unlink() {
    if (!confirm('Délier ce numéro ? Les alertes ne partiront plus jusqu’à ce qu’un numéro soit scanné.')) return;
    try {
      await window.api.whatsapp.logout();
      show('Demande envoyée : un nouveau QR code va apparaître.', 'success');
    } catch (e: any) {
      show(e.message, 'error');
    }
  }

  return (
    <Panel title="WhatsApp des alertes">
      {wa.status === 'open' && (
        <>
          <p className="text-sm mb-3">
            <span className="badge-success">Connecté</span> Les alertes partent du <b className="font-mono">{wa.phone}</b>.
          </p>
          <button onClick={unlink} disabled={wa.logout_pending} className="btn-secondary btn-sm">
            {wa.logout_pending ? 'Changement en cours…' : 'Changer de numéro'}
          </button>
        </>
      )}
      {wa.status === 'qr' && wa.qr_image && (
        <div className="text-center">
          <p className="text-sm text-ink-soft mb-2">
            Sur le téléphone de l’hôtel : WhatsApp → <b>Appareils connectés</b> → <b>Connecter un appareil</b>, puis scannez :
          </p>
          <img src={wa.qr_image} alt="QR code WhatsApp" className="mx-auto w-56 h-56 rounded-lg bg-white p-2" />
        </div>
      )}
      {wa.status === 'connecting' && <p className="text-sm text-ink-soft">Connexion à WhatsApp…</p>}
      {wa.status === 'offline' && (
        <p className="text-sm text-ink-soft">
          <span className="badge-neutral">Hors ligne</span> La passerelle WhatsApp ne répond pas. Les alertes attendent et partiront dès
          qu’elle redémarre.
        </p>
      )}
      {(wa.pending > 0 || wa.failed > 0) && (
        <p className="text-xs text-ink-soft mt-3">
          {wa.pending > 0 && <>{wa.pending} message(s) en attente. </>}
          {wa.failed > 0 && <>{wa.failed} échec(s) cette semaine (voir le Journal).</>}
        </p>
      )}
    </Panel>
  );
}
