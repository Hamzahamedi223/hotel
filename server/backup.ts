import { all, run } from './db';

/** Parent tables before children, so a restore never violates a foreign key. */
export const TABLE_ORDER = [
  'users', 'settings', 'buildings', 'rooms', 'areas', 'equipment', 'contractors', 'suppliers',
  'inventory_parts', 'purchase_orders', 'purchase_order_lines', 'pannes', 'panne_interventions',
  'panne_parts', 'panne_photos', 'inventory_movements', 'maintenance_schedules',
  'maintenance_completions', 'shift_handovers', 'audit_logs',
];

export interface BackupFile {
  app: 'caisse-panne-hotel';
  version: 1;
  created_at: string;
  tables: Record<string, any[]>;
}

export async function exportAll(): Promise<BackupFile> {
  const tables: Record<string, any[]> = {};
  for (const t of TABLE_ORDER) tables[t] = await all(`SELECT * FROM ${t}${t === 'settings' ? '' : ' ORDER BY id'}`);
  return { app: 'caisse-panne-hotel', version: 1, created_at: new Date().toISOString(), tables };
}

/** Replaces every table's contents with the backup's. Call inside a transaction. */
export async function restoreAll(data: BackupFile) {
  if (data?.app !== 'caisse-panne-hotel' || !data.tables) throw new Error("Ce fichier n'est pas une sauvegarde Caisse Panne Hôtel.");
  if (!data.tables.users?.length) throw new Error('Sauvegarde invalide : aucun utilisateur.');
  await run(`TRUNCATE ${TABLE_ORDER.join(', ')} RESTART IDENTITY CASCADE`);
  for (const t of TABLE_ORDER) {
    const rows = data.tables[t] ?? [];
    if (!rows.length) continue;
    const cols = (await all<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?`, [t]
    )).map((c) => c.column_name);
    const use = cols.filter((c) => c in rows[0]);
    // multi-row INSERTs keep a large restore to a few round trips
    const perChunk = Math.max(1, Math.floor(5000 / use.length));
    for (let i = 0; i < rows.length; i += perChunk) {
      const chunk = rows.slice(i, i + perChunk);
      const tuple = `(${use.map(() => '?').join(', ')})`;
      await run(`INSERT INTO ${t} (${use.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')} RETURNING 1`, chunk.flatMap((row) => use.map((c) => row[c])));
    }
    if (use.includes('id')) {
      await run(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT MAX(id) FROM ${t}))`);
    }
  }
}
