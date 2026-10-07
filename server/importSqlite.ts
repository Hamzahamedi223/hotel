import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { transaction } from './db.js';
import { initDatabase } from './seed.js';
import { restoreAll, TABLE_ORDER, type BackupFile } from './backup.js';

/**
 * One-time move of the desktop version's SQLite file into Postgres.
 *   DATABASE_URL=... npm run import:sqlite [path/to/hotel.db]
 * Replaces everything in the target database.
 */
async function main() {
  const file = path.resolve(process.argv[2] ?? path.join('data', 'hotel.db'));
  if (!fs.existsSync(file)) throw new Error(`Fichier introuvable : ${file}`);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(file));

  const tables: Record<string, any[]> = {};
  for (const t of TABLE_ORDER) {
    // tables added after the desktop version (e.g. panne_comments) don't exist there
    const exists = db.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${t}'`).length > 0;
    const res = exists ? db.exec(`SELECT * FROM ${t}`)[0] : undefined;
    tables[t] = res ? res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]]))) : [];
  }
  // Desktop photos were local file paths that don't exist online
  const photos = tables.panne_photos.length;
  tables.panne_photos = [];

  const backup: BackupFile = { app: 'caisse-panne-hotel', version: 1, created_at: new Date().toISOString(), tables };
  console.log(process.env.DATABASE_URL ? 'Importing into DATABASE_URL…' : 'Importing into local data/pglite…');
  await initDatabase();
  await transaction(() => restoreAll(backup));
  for (const t of TABLE_ORDER) if (tables[t].length) console.log(`  ${t}: ${tables[t].length}`);
  if (photos) console.log(`  (${photos} photo(s) skipped — they were files on the old PC)`);
  console.log('Import complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err.message ?? err);
    process.exit(1);
  });
