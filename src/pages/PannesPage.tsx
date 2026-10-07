import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLookups } from '../store/lookupsStore';
import Modal from '../components/Modal';
import { useToast, ToastHost } from '../components/Toast';
import { PanneStatusBadge, PannePriorityBadge } from '../components/badges';
import { money, dateTime, fileUrl } from '../lib/format';
import { buildInterventionReportHtml } from '../lib/print';
import {
  PANNE_CATEGORY_LABELS,
  PANNE_PRIORITY_LABELS,
  GUEST_IMPACT_LABELS,
  PANNE_STATUS_LABELS,
  REPORTER_ROLE_LABELS,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_DEPARTMENT,
  ALLOWED_TRANSITIONS,
  RESPONSE_STATUSES,
  RESPONSE_LABELS,
  hasPermission,
  canSetStatus,
  departmentForCategory,
} from '../../shared/types';
import type { PanneStatus, PanneCategory, PannePriority, GuestImpact, Department, UserRole } from '../../shared/types';
import {
  IconSearch,
  IconPlus,
  IconArrowLeft,
  IconClipboardList,
  IconPrinter,
  IconCamera,
  IconTrash,
  IconAlertTriangle,
} from '../components/icons';
import { useLiveTick } from '../lib/live';
import RoomPicker from '../components/RoomPicker';

/** Staff a ticket of this department can be assigned to (technicians for maintenance, IT users for IT). */
function staffFor(technicians: any[], department: string, keepId?: number | null) {
  return technicians.filter((t) => ROLE_DEPARTMENT[t.role as UserRole] === department || t.id === keepId);
}

const SCOPES: { key: string; label: string }[] = [
  { key: 'open', label: 'Ouverts' },
  { key: '', label: 'Tous' },
];

export default function PannesPage({ onOpenMenu, onNavigate }: { onOpenMenu: () => void; onNavigate: (v: any) => void }) {
  const tick = useLiveTick();
  void onOpenMenu;
  void onNavigate;
  const user = useAuthStore((s) => s.user)!;
  const { technicians, contractors, parts } = useLookups();
  const [rows, setRows] = useState<any[]>([]);
  const [scope, setScope] = useState('open');
  const [priority, setPriority] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const [showPart, setShowPart] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setRows(await window.api.pannes.list({ scope: scope || undefined, priority: priority || undefined, query: query || undefined }));
  }, [scope, priority, query]);
  useEffect(() => {
    load();
  }, [load, tick]);
  // keep the open ticket current too
  useEffect(() => {
    if (tick && selectedId) window.api.pannes.get(selectedId).then(setDetail).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const selectPanne = useCallback(async (id: number) => {
    setSelectedId(id);
    setDetail(await window.api.pannes.get(id));
  }, []);

  async function refreshDetail() {
    if (selectedId) setDetail(await window.api.pannes.get(selectedId));
    load();
  }

  async function changeStatus(next: PanneStatus) {
    try {
      await window.api.pannes.setStatus(user.id, selectedId!, next);
      show(`Statut → ${PANNE_STATUS_LABELS[next]}`, 'success');
      refreshDetail();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  async function print() {
    if (!detail) return;
    const settings = useLookups.getState().settings;
    await window.api.print.document(buildInterventionReportHtml(detail, settings));
  }

  async function addPhoto() {
    try {
      const path = await window.api.photos.pick(user.id);
      if (!path) return;
      await window.api.pannes.addPhoto(user.id, { panne_id: selectedId, file_path: path, stage: 'other' });
      show('Photo ajoutée.', 'success');
      refreshDetail();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  const p = detail?.panne;

  return (
    <div className="h-full flex min-h-0">
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] shrink-0 md:border-r border-line bg-surface flex-col min-h-0`}>
        <div className="p-3.5 border-b border-line shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h1 className="text-sm font-bold">Livre de panne ({rows.length})</h1>
            {hasPermission(user.role, 'panne.create') && (
              <button onClick={() => setShowNew(true)} className="btn-primary btn-xs">
                <IconPlus size={13} /> Nouveau
              </button>
            )}
          </div>
          <div className="relative mb-2">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N°, titre, chambre…" className="input !pl-9 !py-2 text-sm" />
          </div>
          <div className="flex gap-1.5 mb-2">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex-1 ${scope === s.key ? 'bg-brand-600 text-white' : 'bg-surface-alt text-ink-soft'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select className="select !py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Toutes priorités</option>
            {Object.entries(PANNE_PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => selectPanne(r.id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors ${selectedId === r.id ? 'bg-brand-600 text-white' : 'hover:bg-surface-alt'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] opacity-80">{r.ticket_number}</span>
                {selectedId === r.id ? (
                  <span className="text-[11px]">{PANNE_STATUS_LABELS[r.status as PanneStatus]}</span>
                ) : (
                  <PanneStatusBadge status={r.status} />
                )}
              </div>
              <div className="font-semibold text-sm truncate mt-0.5">{r.title}</div>
              <div className={`text-xs mt-0.5 flex items-center gap-1.5 ${selectedId === r.id ? 'text-white/80' : 'text-ink-faint'}`}>
                {selectedId !== r.id && <PannePriorityBadge priority={r.priority} />}
                <span className="truncate">
                  {r.department === 'it' && <span className="font-semibold">IT · </span>}
                  {r.room_number ? `Ch. ${r.room_number}` : r.area_name || r.building_name || '—'}
                  {r.assigned_to_name ? ` · ${r.assigned_to_name}` : r.contractor_name ? ` · ${r.contractor_name}` : ''}
                </span>
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-ink-faint text-center py-10">
              {hasPermission(user.role, 'panne.viewAll') ? 'Aucun ticket.' : 'Aucun ticket pour votre service.'}
            </p>
          )}
        </div>
      </div>

      <div className={`${selectedId ? 'block' : 'hidden md:block'} flex-1 min-w-0 overflow-y-auto scrollbar-thin p-4 md:p-6`}>
        {!detail ? (
          <div className="empty-state h-full justify-center">
            <IconClipboardList size={28} className="text-ink-faint" />
            <p className="text-sm text-ink-soft">Sélectionnez un ticket.</p>
          </div>
        ) : (
          <div className="max-w-3xl">
            <button onClick={() => { setSelectedId(null); setDetail(null); }} className="md:hidden btn-ghost btn-sm !px-2 -ml-2 mb-2">
              <IconArrowLeft size={16} /> Tickets
            </button>
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold">{p.title}</h2>
                  <PannePriorityBadge priority={p.priority} />
                  <PanneStatusBadge status={p.status} />
                </div>
                <p className="text-sm text-ink-soft mt-1">
                  {p.ticket_number} · {p.room_number ? `Chambre ${p.room_number}${p.room_building_name ? ' — ' + p.room_building_name : ''}` : p.area_name || p.building_name || '—'}
                  {p.equipment_name ? ` · ${p.equipment_name}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={print} className="btn-secondary btn-sm"><IconPrinter size={14} /> Imprimer</button>
              </div>
            </div>

            {p.description && <p className="text-sm text-ink-soft mb-4 whitespace-pre-wrap">{p.description}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
              <Stat label="Service" value={DEPARTMENT_LABELS[p.department as Department] ?? '—'} />
              <Stat label="Catégorie" value={PANNE_CATEGORY_LABELS[p.category as PanneCategory]} />
              <Stat label="Impact client" value={GUEST_IMPACT_LABELS[p.guest_impact as GuestImpact]} />
              <Stat label="Signalé par" value={`${p.reported_by_name ?? '—'}${p.reported_by_role ? ' (' + (REPORTER_ROLE_LABELS[p.reported_by_role] ?? p.reported_by_role) + ')' : ''}`} />
              <Stat label="Créé" value={dateTime(p.created_at)} />
            </div>

            {/* Administration: full status control. Department teams answer from the thread below instead. */}
            {hasPermission(user.role, 'panne.status') && !['closed', 'cancelled'].includes(p.status) && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-xs font-semibold text-ink-faint uppercase tracking-wide mr-1">Statut :</span>
                {ALLOWED_TRANSITIONS[p.status as PanneStatus]
                  ?.filter((next) => next !== 'assigned' && canSetStatus(user.role, p.status, next))
                  .map((next) => (
                    <button
                      key={next}
                      onClick={() => changeStatus(next)}
                      className={next === 'cancelled' ? 'btn-danger-soft btn-sm' : next === 'resolved' || next === 'closed' ? 'btn-success btn-sm' : 'btn-secondary btn-sm'}
                    >
                      {PANNE_STATUS_LABELS[next]}
                    </button>
                  ))}
                {hasPermission(user.role, 'panne.assign') && (
                  <button onClick={() => setShowAssign(true)} className="btn-secondary btn-sm ml-auto">
                    {p.assigned_to_name || p.contractor_name ? 'Réassigner' : 'Assigner'}
                  </button>
                )}
              </div>
            )}

            <ThreadSection key={`thread-${p.id}`} panne={p} comments={detail.comments ?? []} onSaved={refreshDetail} show={show} />

            <Section title="Assignation">
              <div className="text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-ink-soft">Technicien</span>
                  <span className="font-semibold">{p.assigned_to_name ?? '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-soft">Prestataire externe</span>
                  <span className="font-semibold">{p.contractor_name ?? '—'}</span>
                </div>
              </div>
            </Section>

            {hasPermission(user.role, 'panne.manage') && (
              <DiagnosisSection key={p.id} panne={p} onSaved={refreshDetail} show={show} userId={user.id} />
            )}

            <Section
              title={`Interventions (${detail.interventions.length})`}
              action={hasPermission(user.role, 'panne.manage') && <button onClick={() => setShowIntervention(true)} className="btn-ghost btn-xs"><IconPlus size={13} /> Ajouter</button>}
            >
              {detail.interventions.map((i: any) => (
                <div key={i.id} className="py-2 border-b border-line last:border-0 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{i.technician_name ?? '—'}</span>
                    <span className="text-xs text-ink-faint">{dateTime(i.started_at)} {i.finished_at ? `→ ${dateTime(i.finished_at)}` : ''}</span>
                  </div>
                  {i.description && <div className="text-ink-soft mt-0.5">{i.description}</div>}
                  {i.result && <div className="text-xs text-ink-faint mt-0.5">Résultat : {i.result}</div>}
                </div>
              ))}
              {detail.interventions.length === 0 && <p className="text-sm text-ink-faint">Aucune intervention.</p>}
            </Section>

            <Section
              title={`Pièces utilisées (${detail.parts.length})`}
              action={hasPermission(user.role, 'panne.manage') && <button onClick={() => setShowPart(true)} className="btn-ghost btn-xs"><IconPlus size={13} /> Ajouter</button>}
            >
              {detail.parts.map((pp: any) => (
                <div key={pp.id} className="flex items-center gap-2 py-1.5 border-b border-line last:border-0 text-sm">
                  <span className="flex-1 truncate">{pp.label}</span>
                  <span className="text-xs text-ink-faint">× {pp.qty}</span>
                  <span className="font-semibold tabular-nums">{money(pp.amount)}</span>
                  {hasPermission(user.role, 'panne.manage') && (
                    <button
                      onClick={async () => {
                        await window.api.pannes.removePart(user.id, pp.id);
                        refreshDetail();
                      }}
                      className="btn-ghost btn-xs !px-1.5 !text-red-600 dark:!text-red-400"
                    >
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
              ))}
              {detail.parts.length === 0 && <p className="text-sm text-ink-faint">Aucune pièce.</p>}
            </Section>

            <CostsSection key={p.id} panne={p} onSaved={refreshDetail} show={show} userId={user.id} canEdit={hasPermission(user.role, 'panne.manage')} />

            <Section
              title={`Photos (${detail.photos.length})`}
              action={<button onClick={addPhoto} className="btn-ghost btn-xs"><IconCamera size={13} /> Ajouter</button>}
            >
              {detail.photos.length === 0 && <p className="text-sm text-ink-faint">Aucune photo.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {detail.photos.map((ph: any) => (
                  <a key={ph.id} href={fileUrl(ph.file_path)} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-surface-alt border border-line">
                    <img src={fileUrl(ph.file_path)} className="w-full h-full object-cover" alt="" />
                  </a>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>

      {showNew && (
        <NewPanneForm
          onClose={() => setShowNew(false)}
          onSaved={async (id: number) => {
            setShowNew(false);
            await load();
            selectPanne(id);
            show('Ticket créé.', 'success');
          }}
          show={show}
        />
      )}
      {showAssign && detail && (
        <AssignModal
          panne={p}
          technicians={technicians}
          contractors={contractors}
          onClose={() => setShowAssign(false)}
          onSaved={() => {
            setShowAssign(false);
            refreshDetail();
            show('Assignation enregistrée.', 'success');
          }}
          show={show}
        />
      )}
      {showIntervention && detail && (
        <InterventionForm
          panneId={p.id}
          technicians={technicians}
          onClose={() => setShowIntervention(false)}
          onSaved={() => {
            setShowIntervention(false);
            refreshDetail();
            show('Intervention enregistrée.', 'success');
          }}
          show={show}
        />
      )}
      {showPart && detail && (
        <PartForm
          panneId={p.id}
          parts={parts}
          onClose={() => setShowPart(false)}
          onSaved={() => {
            setShowPart(false);
            refreshDetail();
            show('Pièce ajoutée.', 'success');
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

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">{title}</h3>
        {action}
      </div>
      <div className="card p-3">{children}</div>
    </div>
  );
}

/**
 * The ticket's conversation. Everyone who can see the ticket can write here;
 * department teams (maintenance, IT) also pick their answer here — that is how
 * they move a ticket, they have no other status control.
 */
function ThreadSection({ panne, comments, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<PanneStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const responses = hasPermission(user.role, 'panne.respond')
    ? RESPONSE_STATUSES.filter((s) => canSetStatus(user.role, panne.status, s))
    : [];
  const canWrite = hasPermission(user.role, 'panne.comment');
  const needsBody = status === 'need_info' || status === 'escalated';

  async function send() {
    if (!status && !body.trim()) return show('Écrivez un message ou choisissez une réponse.', 'error');
    if (needsBody && !body.trim()) return show(status === 'need_info' ? 'Précisez quelle information il vous faut.' : "Expliquez pourquoi il faut escalader.", 'error');
    setBusy(true);
    try {
      await window.api.pannes.comment(user.id, panne.id, { body, status });
      setBody('');
      setStatus(null);
      onSaved();
      show(status ? `Réponse envoyée — ${PANNE_STATUS_LABELS[status]}` : 'Message envoyé.', 'success');
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={`Suivi & réponses (${comments.length})`}>
      {comments.length === 0 && <p className="text-sm text-ink-faint">Aucun message.</p>}
      {comments.map((c: any) => (
        <div key={c.id} className="py-2 border-b border-line last:border-0 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span>
              <span className="font-semibold">{c.user_name ?? '—'}</span>
              {c.user_role && <span className="text-xs text-ink-faint"> · {ROLE_LABELS[c.user_role as UserRole] ?? c.user_role}</span>}
            </span>
            <span className="text-xs text-ink-faint">{dateTime(c.created_at)}</span>
          </div>
          {c.status && (
            <div className="mt-1">
              <PanneStatusBadge status={c.status} />
            </div>
          )}
          {c.body && <div className="text-ink-soft mt-1 whitespace-pre-wrap">{c.body}</div>}
        </div>
      ))}

      {canWrite && (
        <div className={comments.length ? 'mt-3 pt-3 border-t border-line' : 'mt-3'}>
          {responses.length > 0 && (
            <>
              <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1.5">Votre réponse</div>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {responses.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(status === s ? null : s)}
                    className={`btn-sm ${status === s ? (s === 'resolved' ? 'btn-success' : s === 'escalated' ? 'btn-danger-soft' : 'btn-primary') : 'btn-secondary'}`}
                  >
                    {RESPONSE_LABELS[s]}
                  </button>
                ))}
              </div>
            </>
          )}
          <textarea
            className="input mb-2"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              status === 'need_info' ? 'Quelle information vous faut-il ?' :
              status === 'escalated' ? 'Pourquoi ne pouvez-vous pas réparer ?' :
              status === 'waiting_parts' ? 'Quelle pièce / quel matériel ?' :
              'Ajouter un commentaire…'
            }
          />
          <button disabled={busy} onClick={send} className="btn-primary btn-sm">
            {status ? 'Envoyer la réponse' : 'Envoyer'}
          </button>
        </div>
      )}
    </Section>
  );
}

function DiagnosisSection({ panne, onSaved, show, userId }: any) {
  const [f, setF] = useState({ diagnosis: panne.diagnosis ?? '', cause: panne.cause ?? '', recommended_action: panne.recommended_action ?? '' });
  const [dirty, setDirty] = useState(false);
  // take in changes saved from another device, unless this user is mid-edit
  useEffect(() => {
    if (!dirty) setF({ diagnosis: panne.diagnosis ?? '', cause: panne.cause ?? '', recommended_action: panne.recommended_action ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panne.diagnosis, panne.cause, panne.recommended_action]);
  const set = (k: string, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  async function save() {
    try {
      await window.api.pannes.diagnosis(userId, panne.id, f);
      setDirty(false);
      onSaved();
      show('Diagnostic enregistré.', 'success');
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Section title="Diagnostic" action={dirty && <button onClick={save} className="btn-primary btn-xs">Enregistrer</button>}>
      <label className="label">Diagnostic</label>
      <textarea className="input mb-2.5" rows={2} value={f.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />
      <label className="label">Cause</label>
      <textarea className="input mb-2.5" rows={2} value={f.cause} onChange={(e) => set('cause', e.target.value)} />
      <label className="label">Action recommandée</label>
      <textarea className="input" rows={2} value={f.recommended_action} onChange={(e) => set('recommended_action', e.target.value)} />
    </Section>
  );
}

function CostsSection({ panne, onSaved, show, userId, canEdit }: any) {
  const [labor, setLabor] = useState(String(panne.labor_cost));
  const [contractor, setContractor] = useState(String(panne.contractor_cost));
  async function save() {
    try {
      await window.api.pannes.costs(userId, panne.id, { labor_cost: Number(labor) || 0, contractor_cost: Number(contractor) || 0 });
      onSaved();
      show('Coûts mis à jour.', 'success');
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Section title="Coûts">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div>
          <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1">Pièces</div>
          <div className="font-bold text-sm">{money(panne.parts_cost)}</div>
        </div>
        <div>
          <label className="label">Main d'œuvre</label>
          {canEdit ? <input type="number" className="input !py-1.5 text-sm" value={labor} onChange={(e) => setLabor(e.target.value)} /> : <div className="font-bold text-sm">{money(panne.labor_cost)}</div>}
        </div>
        <div>
          <label className="label">Prestataire</label>
          {canEdit ? <input type="number" className="input !py-1.5 text-sm" value={contractor} onChange={(e) => setContractor(e.target.value)} /> : <div className="font-bold text-sm">{money(panne.contractor_cost)}</div>}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-ink-faint mb-1">Total</div>
          <div className="font-extrabold text-sm text-brand-600 dark:text-brand-400">{money(panne.total_cost)}</div>
        </div>
      </div>
      {canEdit && (Number(labor) !== panne.labor_cost || Number(contractor) !== panne.contractor_cost) && (
        <button onClick={save} className="btn-primary btn-xs mt-3">Enregistrer les coûts</button>
      )}
    </Section>
  );
}

function AssignModal({ panne, technicians, contractors, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [assignedTo, setAssignedTo] = useState<string>(panne.assigned_to ?? '');
  const [contractorId, setContractorId] = useState<string>(panne.contractor_id ?? '');
  const [department, setDepartment] = useState<string>(panne.department ?? 'maintenance');
  const staff = staffFor(technicians, department, panne.assigned_to);
  async function submit() {
    try {
      await window.api.pannes.assign(user.id, panne.id, {
        assigned_to: assignedTo ? Number(assignedTo) : null,
        contractor_id: contractorId ? Number(contractorId) : null,
        department,
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal
      title="Assigner le ticket"
      onClose={onClose}
      width="w-[420px]"
      footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}
    >
      <label className="label">Service</label>
      <select className="select mb-3" value={department} onChange={(e) => setDepartment(e.target.value)}>
        {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label className="label">Technicien</label>
      <select className="select mb-3" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">— Aucun —</option>
        {staff.map((t: any) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <label className="label">Prestataire externe</label>
      <select className="select" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
        <option value="">— Aucun —</option>
        {contractors.map((c: any) => (
          <option key={c.id} value={c.id}>{c.company}</option>
        ))}
      </select>
    </Modal>
  );
}

function InterventionForm({ panneId, technicians, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const now = new Date().toISOString().slice(0, 16);
  const [f, setF] = useState({ technician_id: ROLE_DEPARTMENT[user.role] ? user.id : technicians[0]?.id ?? '', description: '', started_at: now, finished_at: '', result: '' });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  async function submit() {
    try {
      await window.api.pannes.intervention(user.id, {
        panne_id: panneId,
        technician_id: f.technician_id ? Number(f.technician_id) : null,
        description: f.description || null,
        started_at: f.started_at ? new Date(f.started_at).toISOString() : null,
        finished_at: f.finished_at ? new Date(f.finished_at).toISOString() : null,
        result: f.result || null,
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }
  return (
    <Modal title="Nouvelle intervention" onClose={onClose} width="w-[520px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <label className="label">Technicien</label>
      <select className="select mb-3" value={f.technician_id} onChange={(e) => set('technician_id', e.target.value)}>
        <option value="">— Aucun —</option>
        {technicians.map((t: any) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="label">Début</label><input type="datetime-local" className="input" value={f.started_at} onChange={(e) => set('started_at', e.target.value)} /></div>
        <div><label className="label">Fin</label><input type="datetime-local" className="input" value={f.finished_at} onChange={(e) => set('finished_at', e.target.value)} /></div>
      </div>
      <label className="label">Description du travail effectué</label>
      <textarea className="input mb-3" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
      <label className="label">Résultat</label>
      <input className="input" value={f.result} onChange={(e) => set('result', e.target.value)} placeholder="Ex : AC opérationnel" />
    </Modal>
  );
}

function PartForm({ panneId, parts, onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const [mode, setMode] = useState<'stock' | 'custom'>('stock');
  const [partId, setPartId] = useState<string>(parts[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');

  useEffect(() => {
    if (mode === 'stock') {
      const part = parts.find((p: any) => String(p.id) === String(partId));
      if (part) setUnitCost(String(part.unit_cost));
    }
  }, [partId, mode, parts]);

  async function submit() {
    try {
      const part = mode === 'stock' ? parts.find((p: any) => String(p.id) === String(partId)) : null;
      await window.api.pannes.addPart(user.id, {
        panne_id: panneId,
        part_id: part ? Number(part.id) : null,
        label: part ? part.name : label,
        qty: Number(qty) || 1,
        unit_cost: Number(unitCost) || 0,
      });
      onSaved();
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
    }
  }

  return (
    <Modal title="Ajouter une pièce" onClose={onClose} width="w-[460px]" footer={<button onClick={submit} className="btn-primary btn-md w-full">Enregistrer</button>}>
      <div className="flex gap-1 bg-surface-alt rounded-lg p-1 mb-3">
        <button onClick={() => setMode('stock')} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${mode === 'stock' ? 'bg-surface shadow-xs' : 'text-ink-soft'}`}>Depuis le stock</button>
        <button onClick={() => setMode('custom')} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${mode === 'custom' ? 'bg-surface shadow-xs' : 'text-ink-soft'}`}>Autre / externe</button>
      </div>
      {mode === 'stock' ? (
        <>
          <label className="label">Pièce</label>
          <select className="select mb-3" value={partId} onChange={(e) => setPartId(e.target.value)}>
            {parts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — dispo {p.quantity} {p.unit}</option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label className="label">Désignation</label>
          <input className="input mb-3" value={label} onChange={(e) => setLabel(e.target.value)} />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Quantité</label><input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label className="label">Coût unitaire</label><input type="number" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function NewPanneForm({ onClose, onSaved, show }: any) {
  const user = useAuthStore((s) => s.user)!;
  const { buildings, rooms, areas, equipment, technicians, contractors } = useLookups();
  const [f, setF] = useState<any>({
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    guest_impact: 'none',
    location_type: 'room',
    room_id: '', // must be picked: a default room would silently mislabel tickets
    area_id: areas[0]?.id ?? '',
    building_id: buildings[0]?.id ?? '',
    equipment_id: '',
    // default to the logged-in person's own department
    reported_by_role: ({ housekeeping: 'housekeeping', manager: 'manager' } as Record<string, string>)[user.role] ?? 'reception',
    department: 'maintenance',
    assigned_to: '',
    contractor_id: '',
  });
  // the team follows the category ("Wi-Fi" → IT) until the reporter picks one themselves
  const [departmentTouched, setDepartmentTouched] = useState(false);
  const set = (k: string, v: any) =>
    setF((x: any) => {
      const next = { ...x, [k]: v };
      if (k === 'category' && !departmentTouched) next.department = departmentForCategory(v);
      if (k === 'category' || k === 'department') {
        // an assignee from the other team would be hidden from the list below
        if (next.department !== x.department) next.assigned_to = '';
      }
      return next;
    });
  const staff = staffFor(technicians, f.department);
  const [busy, setBusy] = useState(false);

  const locationEquipment = equipment.filter((e: any) =>
    f.location_type === 'room' ? String(e.room_id) === String(f.room_id) : f.location_type === 'area' ? String(e.area_id) === String(f.area_id) : false
  );

  async function submit() {
    if (!f.title) return show('Le titre est requis.', 'error');
    if (f.location_type === 'room' && !f.room_id) return show('Choisissez la chambre.', 'error');
    setBusy(true);
    try {
      const result = await window.api.pannes.create(user.id, {
        title: f.title,
        description: f.description || null,
        category: f.category,
        priority: f.priority,
        guest_impact: f.guest_impact,
        location_type: f.location_type,
        room_id: f.location_type === 'room' && f.room_id ? Number(f.room_id) : null,
        area_id: f.location_type === 'area' && f.area_id ? Number(f.area_id) : null,
        building_id: f.location_type === 'building' && f.building_id ? Number(f.building_id) : null,
        equipment_id: f.equipment_id ? Number(f.equipment_id) : null,
        reported_by_role: f.reported_by_role,
        department: f.department,
        assigned_to: f.assigned_to ? Number(f.assigned_to) : null,
        contractor_id: f.contractor_id ? Number(f.contractor_id) : null,
      });
      onSaved(result.panne.id);
    } catch (e: any) {
      show(e.message ?? 'Erreur', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouveau ticket"
      onClose={onClose}
      width="w-[640px]"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary btn-md flex-1">Annuler</button>
          <button disabled={busy} onClick={submit} className="btn-primary btn-md flex-1">Créer le ticket</button>
        </div>
      }
    >
      <label className="label">Titre</label>
      <input className="input mb-3" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex : Climatiseur ne refroidit pas" />

      <label className="label">Description</label>
      <textarea className="input mb-3" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Catégorie</label>
          <select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(PANNE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priorité</label>
          <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(PANNE_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Impact client</label>
          <select className="select" value={f.guest_impact} onChange={(e) => set('guest_impact', e.target.value)}>
            {Object.entries(GUEST_IMPACT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Emplacement</label>
          <select className="select" value={f.location_type} onChange={(e) => set('location_type', e.target.value)}>
            <option value="room">Chambre</option>
            <option value="area">Zone commune</option>
            <option value="building">Bâtiment</option>
          </select>
        </div>
        {f.location_type === 'room' && (
          <div className="col-span-2">
            <label className="label">Chambre</label>
            <RoomPicker rooms={rooms} value={f.room_id} onChange={(id) => set('room_id', id)} />
          </div>
        )}
        {f.location_type === 'area' && (
          <div className="col-span-2">
            <label className="label">Zone</label>
            <select className="select" value={f.area_id} onChange={(e) => set('area_id', e.target.value)}>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}{a.building_name ? ` — ${a.building_name}` : ''}</option>)}
            </select>
          </div>
        )}
        {f.location_type === 'building' && (
          <div className="col-span-2">
            <label className="label">Bâtiment</label>
            <select className="select" value={f.building_id} onChange={(e) => set('building_id', e.target.value)}>
              {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {locationEquipment.length > 0 && (
        <div className="mb-3">
          <label className="label">Équipement concerné (optionnel)</label>
          <select className="select" value={f.equipment_id} onChange={(e) => set('equipment_id', e.target.value)}>
            <option value="">— Aucun —</option>
            {locationEquipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Signalé par</label>
          <select className="select" value={f.reported_by_role} onChange={(e) => set('reported_by_role', e.target.value)}>
            {Object.entries(REPORTER_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Service concerné</label>
          <select
            className="select"
            value={f.department}
            onChange={(e) => {
              setDepartmentTouched(true);
              set('department', e.target.value);
            }}
          >
            {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Assigner à</label>
          <select className="select" value={f.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
            <option value="">— Plus tard —</option>
            {staff.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ou prestataire</label>
          <select className="select" value={f.contractor_id} onChange={(e) => set('contractor_id', e.target.value)}>
            <option value="">— Aucun —</option>
            {contractors.map((c: any) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </div>
      </div>
      {f.priority === 'critical' && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mt-3 bg-red-500/10 rounded-lg px-3 py-2">
          <IconAlertTriangle size={15} /> Priorité critique : la chambre concernée sera automatiquement mise hors service.
        </div>
      )}
    </Modal>
  );
}
