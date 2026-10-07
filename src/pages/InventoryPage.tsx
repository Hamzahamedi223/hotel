import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { dateTime, money } from '../lib/format';
import { IconPlus, IconAlertTriangle, IconEdit } from '../components/icons';

type Tab = 'parts' | 'movements' | 'suppliers' | 'orders';

export default function InventoryPage() {
  const user = useAuthStore((s) => s.user)!;
  const refreshLookups = useLookups((s) => s.refresh);
  const [tab, setTab] = useState<Tab>('parts');
  const [parts, setParts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [stockModal, setStockModal] = useState<{ part: any; mode: 'receive' | 'adjust' } | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setParts(await window.api.inventory.list());
    setMovements(await window.api.inventory.movements());
    setSuppliers(await window.api.suppliers.list());
    setOrders(await window.api.purchaseOrders.list());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function refreshAll() {
    await load();
    refreshLookups();
  }

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-surface-alt rounded-lg p-1 max-w-full overflow-x-auto scrollbar-thin">
          {(['parts', 'movements', 'orders', 'suppliers'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${tab === t ? 'bg-surface shadow-xs text-ink' : 'text-ink-soft'}`}>
              {t === 'parts' ? 'Pièces' : t === 'movements' ? 'Mouvements' : t === 'orders' ? 'Commandes' : 'Fournisseurs'}
            </button>
          ))}
        </div>
        {tab === 'parts' && <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary btn-sm"><IconPlus size={14} /> Pièce</button>}
        {tab === 'orders' && <button onClick={() => setShowOrderForm(true)} className="btn-primary btn-sm"><IconPlus size={14} /> Bon de commande</button>}
      </div>

      {tab === 'parts' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Nom</th><th>Catégorie</th><th>Stock</th><th>Min.</th><th>Coût unit.</th><th>Fournisseur</th><th></th></tr></thead>
            <tbody>
              {parts.map((p) => {
                const low = p.quantity <= p.min_quantity;
                return (
                  <tr key={p.id} className={low ? 'bg-red-500/5' : ''}>
                    <td className="font-mono text-xs">{p.code}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.category}</td>
                    <td className={`tabular-nums font-semibold ${low ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {low && <IconAlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                      {p.quantity} {p.unit}
                    </td>
                    <td className="tabular-nums text-ink-faint">{p.min_quantity}</td>
                    <td className="tabular-nums">{money(p.unit_cost)}</td>
                    <td>{p.supplier_name ?? '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => setStockModal({ part: p, mode: 'receive' })} className="btn-ghost btn-xs">Réceptionner</button>
                      <button onClick={() => setStockModal({ part: p, mode: 'adjust' })} className="btn-ghost btn-xs">Ajuster</button>
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="btn-ghost btn-xs !px-1.5"><IconEdit size={13} /></button>
                    </td>
                  </tr>
                );
              })}
              {parts.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-ink-faint">Aucune pièce.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Pièce</th><th>Type</th><th>Qté</th><th>Motif</th><th>Ticket</th><th>Utilisateur</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="text-xs text-ink-soft whitespace-nowrap">{dateTime(m.created_at)}</td>
                  <td>{m.part_name}</td>
                  <td>
                    <span className={m.type === 'in' ? 'badge-success' : m.type === 'out' ? 'badge-warn' : 'badge-neutral'}>
                      {m.type === 'in' ? 'Entrée' : m.type === 'out' ? 'Sortie' : 'Ajustement'}
                    </span>
                  </td>
                  <td className="tabular-nums">{m.qty}</td>
                  <td className="text-ink-soft">{m.reason ?? '—'}</td>
                  <td className="font-mono text-xs">{m.ticket_number ?? '—'}</td>
                  <td>{m.user_name ?? '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-ink-faint">Aucun mouvement.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>N°</th><th>Fournisseur</th><th>Statut</th><th>Créé le</th><th>Reçu le</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.po_number}</td>
                  <td>{o.supplier_name ?? '—'}</td>
                  <td>
                    <span className={o.status === 'received' ? 'badge-success' : o.status === 'cancelled' ? 'badge-neutral' : 'badge-warn'}>
                      {o.status === 'draft' ? 'Brouillon' : o.status === 'ordered' ? 'Commandé' : o.status === 'received' ? 'Reçu' : 'Annulé'}
                    </span>
                  </td>
                  <td className="text-xs text-ink-soft whitespace-nowrap">{dateTime(o.created_at)}</td>
                  <td className="text-xs text-ink-soft whitespace-nowrap">{o.received_at ? dateTime(o.received_at) : '—'}</td>
                  <td className="text-right">
                    {o.status !== 'received' && (
                      <button
                        onClick={async () => {
                          try {
                            await window.api.purchaseOrders.receive(user.id, o.id);
                            await refreshAll();
                            show('Bon de commande réceptionné.', 'success');
                          } catch (e: any) {
                            show(e.message ?? 'Erreur', 'error');
                          }
                        }}
                        className="btn-secondary btn-xs"
                      >
                        Réceptionner
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-ink-faint">Aucun bon de commande.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suppliers' && (
        <SuppliersList
          rows={suppliers}
          onSave={async (row: any) => {
            try {
              await window.api.suppliers.save(user.id, row);
              await refreshAll();
              show('Enregistré.', 'success');
            } catch (e: any) {
              show(e.message ?? 'Erreur', 'error');
            }
          }}
          onDelete={async (row: any) => {
            try {
              await window.api.suppliers.delete(user.id, row.id);
              await refreshAll();
              show('Fournisseur supprimé.', 'success');
            } catch (e: any) {
              show(e.message ?? 'Erreur', 'error');
            }
          }}
        />
      )}

      {showForm && (
        <PartForm
          editing={editing}
          suppliers={suppliers}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await refreshAll(); show('Pièce enregistrée.', 'success'); }}
          show={show}
        />
      )}
      {stockModal && (
        <StockModal
          part={stockModal.part}
          mode={stockModal.mode}
          onClose={() => setStockModal(null)}
          onSaved={async () => { setStockModal(null); await refreshAll(); show('Stock mis à jour.', 'success'); }}
          show={show}
        />
      )}
      {showOrderForm && (
        <PurchaseOrderForm
          parts={parts}
          suppliers={suppliers}
          onClose={() => setShowOrderForm(false)}
          onSaved={async () => { setShowOrderForm(false); await refreshAll(); show('Bon de commande créé.', 'success'); }}
          show={show}
        />
      )}
      <ToastHost toast={toast} />
    </div>
  );
}

function PartForm({ editing, suppliers, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [f, setF] = useState<any>(
    editing ?? { name: '', category: '', unit: 'pièce', quantity: 0, min_quantity: 0, unit_cost: 0, supplier_id: '', location: '', part_number: '', notes: '' }
  );
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.name) return show('Le nom est requis.', 'error');
    try {
      await window.api.inventory.save(user.id, {
        ...f,
        quantity: Number(f.quantity) || 0,
        min_quantity: Number(f.min_quantity) || 0,
        unit_cost: Number(f.unit_cost) || 0,
        supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title={editing ? 'Modifier la pièce' : 'Nouvelle pièce'} onClose={onClose} width="w-[520px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Nom</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Catégorie</label><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Électrique, Plomberie…" /></div>
        <div><label className="label">Unité</label><input className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)} /></div>
        {!editing && <>
          <div><label className="label">Quantité initiale</label><input type="number" className="input" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        </>}
        <div><label className="label">Stock minimum</label><input type="number" className="input" value={f.min_quantity} onChange={(e) => set('min_quantity', e.target.value)} /></div>
        <div><label className="label">Coût unitaire</label><input type="number" className="input" value={f.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} /></div>
        <div>
          <label className="label">Fournisseur</label>
          <select className="select" value={f.supplier_id ?? ''} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">—</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="label">Emplacement</label><input className="input" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} /></div>
        <div><label className="label">Référence</label><input className="input" value={f.part_number ?? ''} onChange={(e) => set('part_number', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function StockModal({ part, mode, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState(mode === 'receive' ? 'Réception fournisseur' : '');
  const [unitCost, setUnitCost] = useState(String(part.unit_cost));
  async function submit() {
    try {
      if (mode === 'receive') {
        await window.api.inventory.receive(user.id, { part_id: part.id, qty: Number(qty) || 0, unit_cost: Number(unitCost) || undefined, reason });
      } else {
        if (!reason) return show('Indiquez un motif.', 'error');
        await window.api.inventory.adjust(user.id, { part_id: part.id, qty: Number(qty) || 0, reason });
      }
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title={`${mode === 'receive' ? 'Réceptionner' : 'Ajuster'} — ${part.name}`} onClose={onClose} width="w-[420px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <p className="text-sm text-ink-soft mb-3">Stock actuel : <strong>{part.quantity} {part.unit}</strong></p>
      <label className="label">{mode === 'adjust' ? 'Variation (peut être négative)' : 'Quantité reçue'}</label>
      <input type="number" className="input mb-3" value={qty} onChange={(e) => setQty(e.target.value)} />
      {mode === 'receive' && (
        <>
          <label className="label">Coût unitaire</label>
          <input type="number" className="input mb-3" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </>
      )}
      <label className="label">Motif</label>
      <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function SuppliersList({ rows, onSave, onDelete }: { rows: any[]; onSave: (row: any) => void; onDelete: (row: any) => void }) {
  const [draft, setDraft] = useState({ name: '', contact_name: '', phone: '', email: '' });
  return (
    <div className="table-wrap max-w-3xl">
      <table className="table">
        <thead><tr><th>Nom</th><th>Contact</th><th>Téléphone</th><th>Email</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.name}</td>
              <td>{r.contact_name ?? '—'}</td>
              <td>{r.phone ?? '—'}</td>
              <td>{r.email ?? '—'}</td>
              <td className="text-right">
                <button onClick={() => { if (confirm(`Supprimer « ${r.name} » ?`)) onDelete(r); }} className="btn-ghost btn-xs !text-red-600 dark:!text-red-400">Supprimer</button>
              </td>
            </tr>
          ))}
          <tr>
            <td><input className="input !py-1.5 text-sm" placeholder="Nom…" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
            <td><input className="input !py-1.5 text-sm" value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} /></td>
            <td><input className="input !py-1.5 text-sm" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></td>
            <td><input className="input !py-1.5 text-sm" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></td>
            <td className="text-right">
              <button
                onClick={() => {
                  if (!draft.name) return;
                  onSave(draft);
                  setDraft({ name: '', contact_name: '', phone: '', email: '' });
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

function PurchaseOrderForm({ parts, suppliers, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [lines, setLines] = useState<Array<{ part_id: string; label: string; qty: string; unit_cost: string }>>([
    { part_id: parts[0]?.id ?? '', label: '', qty: '1', unit_cost: '0' },
  ]);
  const [notes, setNotes] = useState('');

  function updateLine(i: number, patch: Partial<{ part_id: string; label: string; qty: string; unit_cost: string }>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    try {
      await window.api.purchaseOrders.create(user.id, {
        supplier_id: supplierId ? Number(supplierId) : null,
        status: 'ordered',
        notes: notes || null,
        lines: lines
          .filter((l) => l.part_id || l.label)
          .map((l) => {
            const part = parts.find((p: any) => String(p.id) === String(l.part_id));
            return {
              part_id: part ? Number(part.id) : null,
              label: part ? part.name : l.label,
              qty: Number(l.qty) || 1,
              unit_cost: Number(l.unit_cost) || 0,
            };
          }),
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  return (
    <Modal title="Nouveau bon de commande" onClose={onClose} width="w-[600px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Créer</button>}>
      <label className="label">Fournisseur</label>
      <select className="select mb-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
        <option value="">—</option>
        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <label className="label">Lignes</label>
      <div className="space-y-2 mb-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_90px] gap-2">
            <select className="select !py-1.5 text-sm" value={l.part_id} onChange={(e) => updateLine(i, { part_id: e.target.value })}>
              <option value="">— Libre —</option>
              {parts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" className="input !py-1.5 text-sm" placeholder="Qté" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
            <input type="number" className="input !py-1.5 text-sm" placeholder="PU" value={l.unit_cost} onChange={(e) => updateLine(i, { unit_cost: e.target.value })} />
          </div>
        ))}
      </div>
      <button onClick={() => setLines((ls) => [...ls, { part_id: '', label: '', qty: '1', unit_cost: '0' }])} className="btn-ghost btn-xs mb-3">
        + Ajouter une ligne
      </button>

      <label className="label">Notes</label>
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}
