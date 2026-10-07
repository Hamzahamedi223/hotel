import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { dateTime } from '../lib/format';

export default function AuditLogPage() {
  const user = useAuthStore((s) => s.user)!;
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    window.api.reports.auditLog(user.id, 400).then(setRows);
  }, [user.id]);

  const shown = filter ? rows.filter((r) => r.action.includes(filter) || (r.user_name ?? '').toLowerCase().includes(filter.toLowerCase())) : rows;

  return (
    <div className="h-full p-4 md:p-6 overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-xl font-bold">Journal d'audit</h1>
        <input className="input !py-2 text-sm w-full sm:w-64" placeholder="Filtrer par action ou agent…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Agent</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="text-ink-soft text-xs whitespace-nowrap">{dateTime(r.created_at)}</td>
                <td>{r.user_name ?? '—'}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-ink-soft text-xs">
                  {r.entity_type ?? ''} {r.entity_id ?? ''}
                </td>
                <td className="text-xs text-ink-faint max-w-[380px] truncate">{r.details ?? ''}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-6 text-ink-faint">
                  Aucune entrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
