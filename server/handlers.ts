import bcrypt from 'bcryptjs';
import { all, get, run, transaction } from './db.js';
import { exportAll, restoreAll } from './backup.js';
import { storePhoto, archiveDownloadUrl } from './photos.js';
import { runArchive, eligibleCount, ARCHIVE_AFTER_DAYS } from './archive.js';
import { hasPermission, PERMISSIONS, OPEN_PANNE_STATUSES, USER_ROLES, canSetStatus, canViewPanne } from '../shared/types.js';
import type { UserRole, PanneStatus } from '../shared/types.js';
import {
  audit,
  settingsMap,
  createPanne,
  assignPanne,
  setPanneStatus,
  saveDiagnosis,
  addIntervention,
  addPanneCosts,
  addPannePart,
  removePannePart,
  addPannePhoto,
  addPanneComment,
  panneDetail,
  panneScope,
  type Actor,
  roomHistory,
  equipmentHistory,
  receiveStock,
  adjustStock,
  createPurchaseOrder,
  purchaseOrderDetail,
  receivePurchaseOrder,
  saveMaintenanceSchedule,
  completeMaintenanceSchedule,
  addShiftHandover,
  dashboardSummary,
  reportFrequency,
  reportRooms,
  reportEquipment,
  reportCosts,
  reportTechnicianPerformance,
  reportResolutionTime,
  type PanneInput,
} from './services.js';

type Perm = keyof typeof PERMISSIONS;

/** Every handler receives the authenticated caller first; the rest are the client's arguments. */
export type Handler = (ctx: { actorId: number | null }, ...args: any[]) => Promise<any>;
export const handlers: Record<string, Handler> = {};
const ipcMain = { handle: (channel: string, fn: Handler) => { handlers[channel] = fn; } };

async function requireRole(userId: number, permission: Perm) {
  const user = await get<{ role: UserRole; active: number }>('SELECT role, active FROM users WHERE id = ?', [userId]);
  if (!user || !user.active) throw new Error('Utilisateur invalide ou désactivé.');
  if (!hasPermission(user.role, permission)) throw new Error(`Permission refusée : ${permission}.`);
  return user;
}

/** The logged-in caller (rpc.ts has already checked the token and that the account is active). */
async function actorOf(userId: number | null): Promise<Actor> {
  const user = userId == null ? null : await get<{ role: UserRole }>('SELECT role FROM users WHERE id = ?', [userId]);
  if (!user) throw new Error('Utilisateur invalide ou désactivé.');
  return { id: userId!, role: user.role };
}

/** Loads a ticket the actor may see, so a department team can't read or act on another team's tickets by id. */
async function visiblePanne(actor: Actor, panneId: number) {
  const p = await get<{ id: number; status: PanneStatus; department: string; assigned_to: number | null }>(
    'SELECT id, status, department, assigned_to FROM pannes WHERE id = ?', [panneId]
  );
  if (!p || !canViewPanne(actor.role, actor.id, p)) throw new Error('Ticket introuvable.');
  return p;
}

/** requireRole + visiblePanne: the guard for an action on one ticket. */
async function requirePanne(actorId: number, permission: Perm, panneId: number) {
  const user = await requireRole(actorId, permission);
  const actor: Actor = { id: actorId, role: user.role };
  return { actor, panne: await visiblePanne(actor, panneId) };
}

function buildSet(fields: string[], input: Record<string, any>) {
  const sets: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (f in input) {
      sets.push(`${f} = ?`);
      params.push(input[f]);
    }
  }
  return { sets, params };
}

export function registerHandlers() {
  /* ---------- AUTH / USERS ---------- */
  ipcMain.handle('auth:login', async (_e, username: string, password: string) => {
    const user = await get<any>('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
      throw new Error('Identifiants invalides.');
    }
    await audit(user.id, 'auth.login', 'user', user.id);
    return { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  });

  ipcMain.handle('users:list', async () => await all('SELECT id, username, full_name, role, active FROM users ORDER BY full_name'));
  ipcMain.handle('users:technicians', async () => await all("SELECT id, username, full_name, role FROM users WHERE role IN ('technician','it') AND active = 1 ORDER BY full_name"));

  ipcMain.handle('users:create', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'user.manage');
    const hash = bcrypt.hashSync(input.password, 10);
    const { lastInsertRowid } = await run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', [
      input.username, hash, input.full_name, input.role,
    ]);
    await audit(actorId, 'user.create', 'user', lastInsertRowid, { username: input.username, role: input.role });
    return { id: lastInsertRowid };
  });
  ipcMain.handle('users:update', async (_e, actorId: number, userId: number, input: any) => {
    await requireRole(actorId, 'user.manage');
    const username = String(input?.username ?? '').trim();
    const full_name = String(input?.full_name ?? '').trim();
    const role = String(input?.role ?? '') as UserRole;
    if (!username || !full_name) throw new Error('Nom et identifiant sont requis.');
    if (!USER_ROLES.includes(role)) throw new Error('Rôle invalide.');
    if (actorId === userId && role !== 'admin') throw new Error('Vous ne pouvez pas retirer votre propre rôle administrateur.');
    const before = await get<any>('SELECT username, full_name, role FROM users WHERE id = ?', [userId]);
    if (!before) throw new Error('Utilisateur introuvable.');
    if (await get('SELECT id FROM users WHERE username = ? AND id <> ?', [username, userId])) {
      throw new Error(`L'identifiant « ${username} » est déjà utilisé.`);
    }
    await run('UPDATE users SET username = ?, full_name = ?, role = ? WHERE id = ?', [username, full_name, role, userId]);
    await audit(actorId, 'user.update', 'user', userId, { before, after: { username, full_name, role } });
  });
  ipcMain.handle('users:setActive', async (_e, actorId: number, userId: number, active: boolean) => {
    await requireRole(actorId, 'user.manage');
    if (actorId === userId && !active) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
    await run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, userId]);
    await audit(actorId, 'user.setActive', 'user', userId, { active });
  });
  ipcMain.handle('users:resetPassword', async (_e, actorId: number, userId: number, newPassword: string) => {
    await requireRole(actorId, 'user.manage');
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), userId]);
    await audit(actorId, 'user.resetPassword', 'user', userId);
  });

  /* ---------- LOOKUPS ---------- */
  ipcMain.handle('lookups:all', async () => ({
    buildings: await all('SELECT * FROM buildings WHERE active = 1 ORDER BY name'),
    rooms: await all(
      `SELECT r.*, b.name AS building_name FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id ORDER BY b.name, r.room_number`
    ),
    areas: await all(`SELECT a.*, b.name AS building_name FROM areas a LEFT JOIN buildings b ON b.id = a.building_id ORDER BY b.name, a.name`),
    equipment: await all(
      `SELECT e.*, r.room_number, a.name AS area_name FROM equipment e LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN areas a ON a.id = e.area_id ORDER BY e.name`
    ),
    contractors: await all('SELECT * FROM contractors WHERE active = 1 ORDER BY company'),
    suppliers: await all('SELECT * FROM suppliers WHERE active = 1 ORDER BY name'),
    technicians: await all("SELECT id, username, full_name, role FROM users WHERE role IN ('technician','it') AND active = 1 ORDER BY full_name"),
    parts: await all('SELECT * FROM inventory_parts ORDER BY name'),
    settings: await settingsMap(),
  }));

  /* ---------- BUILDINGS / ROOMS / AREAS ---------- */
  ipcMain.handle('buildings:list', async () => await all('SELECT * FROM buildings ORDER BY name'));
  ipcMain.handle('buildings:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'room.manage');
    if (input.id) {
      await run('UPDATE buildings SET name=?, active=? WHERE id=?', [input.name, input.active ? 1 : 0, input.id]);
      await audit(actorId, 'building.update', 'building', input.id, input);
      return { id: input.id };
    }
    const { lastInsertRowid } = await run('INSERT INTO buildings (name) VALUES (?)', [input.name]);
    await audit(actorId, 'building.create', 'building', lastInsertRowid, input);
    return { id: lastInsertRowid };
  });
  ipcMain.handle('buildings:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'room.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM rooms WHERE building_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} chambre(s) rattachée(s). Décochez « Actif » à la place.`);
    await run('DELETE FROM buildings WHERE id = ?', [id]);
    await audit(actorId, 'building.delete', 'building', id);
  });

  const ROOM_SELECT = `SELECT r.*, b.name AS building_name,
    (SELECT COUNT(*) FROM pannes p WHERE p.room_id = r.id AND p.status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')})) AS open_pannes
    FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id`;
  ipcMain.handle('rooms:list', async (_e, opts: { buildingId?: number; status?: string; query?: string } = {}) => {
    const clauses: string[] = [];
    const params: any[] = [...OPEN_PANNE_STATUSES];
    if (opts.buildingId) { clauses.push('r.building_id = ?'); params.push(opts.buildingId); }
    if (opts.status) { clauses.push('r.status = ?'); params.push(opts.status); }
    if (opts.query) { clauses.push('r.room_number ILIKE ?'); params.push(`%${opts.query}%`); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return await all(`${ROOM_SELECT} ${where} ORDER BY b.name, r.room_number`, params);
  });
  ipcMain.handle('rooms:get', async (_e, id: number) => await get(`${ROOM_SELECT} WHERE r.id = ?`, [...OPEN_PANNE_STATUSES, id]));
  ipcMain.handle('rooms:history', async (ctx, id: number) => await roomHistory(id, await actorOf(ctx.actorId)));
  ipcMain.handle('rooms:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'room.manage');
    if (input.id) {
      await run('UPDATE rooms SET building_id=?, floor=?, room_number=?, room_type=?, status=?, notes=? WHERE id=?', [
        input.building_id ?? null, input.floor ?? null, input.room_number, input.room_type ?? null, input.status, input.notes ?? null, input.id,
      ]);
      await audit(actorId, 'room.update', 'room', input.id, { room_number: input.room_number });
      return { id: input.id };
    }
    const { lastInsertRowid } = await run('INSERT INTO rooms (building_id, floor, room_number, room_type, status, notes) VALUES (?,?,?,?,?,?)', [
      input.building_id ?? null, input.floor ?? null, input.room_number, input.room_type ?? null, input.status ?? 'available', input.notes ?? null,
    ]);
    await audit(actorId, 'room.create', 'room', lastInsertRowid, { room_number: input.room_number });
    return { id: lastInsertRowid };
  });
  ipcMain.handle('rooms:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'room.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM pannes WHERE room_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} ticket(s) rattaché(s) à cette chambre.`);
    await run('DELETE FROM rooms WHERE id = ?', [id]);
    await audit(actorId, 'room.delete', 'room', id);
  });

  ipcMain.handle('areas:list', async () => await all('SELECT a.*, b.name AS building_name FROM areas a LEFT JOIN buildings b ON b.id = a.building_id ORDER BY b.name, a.name'));
  ipcMain.handle('areas:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'room.manage');
    if (input.id) {
      await run('UPDATE areas SET building_id=?, name=?, area_type=?, notes=? WHERE id=?', [input.building_id ?? null, input.name, input.area_type, input.notes ?? null, input.id]);
      await audit(actorId, 'area.update', 'area', input.id, input);
      return { id: input.id };
    }
    const { lastInsertRowid } = await run('INSERT INTO areas (building_id, name, area_type, notes) VALUES (?,?,?,?)', [input.building_id ?? null, input.name, input.area_type, input.notes ?? null]);
    await audit(actorId, 'area.create', 'area', lastInsertRowid, input);
    return { id: lastInsertRowid };
  });
  ipcMain.handle('areas:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'room.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM pannes WHERE area_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} ticket(s) rattaché(s).`);
    await run('DELETE FROM areas WHERE id = ?', [id]);
    await audit(actorId, 'area.delete', 'area', id);
  });

  /* ---------- EQUIPMENT ---------- */
  const EQUIPMENT_SELECT = `SELECT e.*, r.room_number, b1.name AS room_building_name, a.name AS area_name, b2.name AS building_name
    FROM equipment e
    LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN buildings b1 ON b1.id = r.building_id
    LEFT JOIN areas a ON a.id = e.area_id
    LEFT JOIN buildings b2 ON b2.id = e.building_id`;
  ipcMain.handle('equipment:list', async (_e, opts: { query?: string; status?: string; category?: string } = {}) => {
    const clauses: string[] = [];
    const params: any[] = [];
    if (opts.query) { clauses.push('(e.code ILIKE ? OR e.name ILIKE ?)'); params.push(`%${opts.query}%`, `%${opts.query}%`); }
    if (opts.status) { clauses.push('e.status = ?'); params.push(opts.status); }
    if (opts.category) { clauses.push('e.category = ?'); params.push(opts.category); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return await all(`${EQUIPMENT_SELECT} ${where} ORDER BY e.name`, params);
  });
  ipcMain.handle('equipment:get', async (_e, id: number) => await get(`${EQUIPMENT_SELECT} WHERE e.id = ?`, [id]));
  ipcMain.handle('equipment:history', async (ctx, id: number) => await equipmentHistory(id, await actorOf(ctx.actorId)));
  async function nextEquipmentCode(): Promise<string> {
    const last = await get<{ code: string }>("SELECT code FROM equipment WHERE code LIKE 'EQ-%' ORDER BY id DESC LIMIT 1", []);
    const n = last ? parseInt(last.code.replace('EQ-', ''), 10) + 1 : 1;
    return `EQ-${String(n).padStart(4, '0')}`;
  }
  const EQUIPMENT_FIELDS = ['name', 'category', 'room_id', 'area_id', 'building_id', 'brand', 'model', 'serial_number', 'install_date', 'warranty_expiry', 'status', 'notes'];
  ipcMain.handle('equipment:create', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'equipment.manage');
    const code = input.code || await nextEquipmentCode();
    if (await get('SELECT id FROM equipment WHERE code = ?', [code])) throw new Error(`Le code ${code} existe déjà.`);
    const { sets, params } = buildSet(EQUIPMENT_FIELDS, input);
    const cols = ['code', ...sets.map((s) => s.split(' = ')[0])];
    const { lastInsertRowid } = await run(`INSERT INTO equipment (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, [code, ...params]);
    await audit(actorId, 'equipment.create', 'equipment', lastInsertRowid, { code });
    return { id: lastInsertRowid, code };
  });
  ipcMain.handle('equipment:update', async (_e, actorId: number, id: number, input: any) => {
    await requireRole(actorId, 'equipment.manage');
    const { sets, params } = buildSet(EQUIPMENT_FIELDS, input);
    if (sets.length === 0) return;
    sets.push("updated_at = now_txt()");
    await run(`UPDATE equipment SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    await audit(actorId, 'equipment.update', 'equipment', id, input);
  });
  ipcMain.handle('equipment:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'equipment.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM pannes WHERE equipment_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} ticket(s) rattaché(s). Passez-le en « Hors service » à la place.`);
    return transaction(async () => {
      await run('DELETE FROM maintenance_schedules WHERE equipment_id = ?', [id]);
      await run('DELETE FROM equipment WHERE id = ?', [id]);
      await audit(actorId, 'equipment.delete', 'equipment', id);
    });
  });

  /* ---------- CONTRACTORS / SUPPLIERS ---------- */
  ipcMain.handle('contractors:list', async () => await all('SELECT * FROM contractors ORDER BY company'));
  ipcMain.handle('contractors:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'contractor.manage');
    if (input.id) {
      await run('UPDATE contractors SET company=?, contact_name=?, phone=?, email=?, service_type=?, contract_info=?, rate=?, notes=?, active=? WHERE id=?', [
        input.company, input.contact_name ?? null, input.phone ?? null, input.email ?? null, input.service_type ?? null,
        input.contract_info ?? null, input.rate ?? null, input.notes ?? null, input.active ? 1 : 0, input.id,
      ]);
      await audit(actorId, 'contractor.update', 'contractor', input.id, { company: input.company });
      return { id: input.id };
    }
    const { lastInsertRowid } = await run('INSERT INTO contractors (company, contact_name, phone, email, service_type, contract_info, rate, notes) VALUES (?,?,?,?,?,?,?,?)', [
      input.company, input.contact_name ?? null, input.phone ?? null, input.email ?? null, input.service_type ?? null, input.contract_info ?? null, input.rate ?? null, input.notes ?? null,
    ]);
    await audit(actorId, 'contractor.create', 'contractor', lastInsertRowid, { company: input.company });
    return { id: lastInsertRowid };
  });
  ipcMain.handle('contractors:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'contractor.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM pannes WHERE contractor_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} ticket(s) rattaché(s). Décochez « Actif » à la place.`);
    await run('DELETE FROM contractors WHERE id = ?', [id]);
    await audit(actorId, 'contractor.delete', 'contractor', id);
  });

  ipcMain.handle('suppliers:list', async () => await all('SELECT * FROM suppliers ORDER BY name'));
  ipcMain.handle('suppliers:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'purchase.manage');
    if (input.id) {
      await run('UPDATE suppliers SET name=?, contact_name=?, phone=?, email=?, notes=?, active=? WHERE id=?', [
        input.name, input.contact_name ?? null, input.phone ?? null, input.email ?? null, input.notes ?? null, input.active ? 1 : 0, input.id,
      ]);
      return { id: input.id };
    }
    const { lastInsertRowid } = await run('INSERT INTO suppliers (name, contact_name, phone, email, notes) VALUES (?,?,?,?,?)', [
      input.name, input.contact_name ?? null, input.phone ?? null, input.email ?? null, input.notes ?? null,
    ]);
    await audit(actorId, 'supplier.create', 'supplier', lastInsertRowid, { name: input.name });
    return { id: lastInsertRowid };
  });
  ipcMain.handle('suppliers:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'purchase.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM inventory_parts WHERE supplier_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} pièce(s) rattachée(s).`);
    await run('DELETE FROM suppliers WHERE id = ?', [id]);
    await audit(actorId, 'supplier.delete', 'supplier', id);
  });

  /* ---------- PANNES (LIVRE DE PANNE) ---------- */
  const PANNE_LIST_SELECT = `SELECT p.*, r.room_number, b1.name AS room_building_name, a.name AS area_name, b3.name AS building_name,
      e.name AS equipment_name, au.full_name AS assigned_to_name, c.company AS contractor_name
    FROM pannes p
    LEFT JOIN rooms r ON r.id = p.room_id LEFT JOIN buildings b1 ON b1.id = r.building_id
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN buildings b3 ON b3.id = p.building_id
    LEFT JOIN equipment e ON e.id = p.equipment_id
    LEFT JOIN users au ON au.id = p.assigned_to
    LEFT JOIN contractors c ON c.id = p.contractor_id`;

  ipcMain.handle('pannes:list', async (ctx, opts: { status?: string; scope?: string; priority?: string; category?: string; assignedTo?: number; query?: string } = {}) => {
    const visible = panneScope(await actorOf(ctx.actorId));
    const clauses: string[] = [visible.sql];
    const params: any[] = [...visible.params];
    if (opts.status) { clauses.push('p.status = ?'); params.push(opts.status); }
    if (opts.scope === 'done') { clauses.push("p.status IN ('resolved','closed','cancelled')"); }
    if (opts.scope === 'open') { clauses.push(`p.status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')})`); params.push(...OPEN_PANNE_STATUSES); }
    if (opts.priority) { clauses.push('p.priority = ?'); params.push(opts.priority); }
    if (opts.category) { clauses.push('p.category = ?'); params.push(opts.category); }
    if (opts.assignedTo) { clauses.push('p.assigned_to = ?'); params.push(opts.assignedTo); }
    if (opts.query) {
      clauses.push('(p.ticket_number ILIKE ? OR p.title ILIKE ? OR r.room_number ILIKE ?)');
      const q = `%${opts.query}%`;
      params.push(q, q, q);
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return await all(
      `${PANNE_LIST_SELECT} ${where} ORDER BY CASE p.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, p.created_at DESC LIMIT 400`,
      params
    );
  });
  ipcMain.handle('pannes:get', async (ctx, id: number) => {
    await visiblePanne(await actorOf(ctx.actorId), id);
    return await panneDetail(id);
  });
  ipcMain.handle('pannes:create', async (_e, actorId: number, input: PanneInput) => {
    await requireRole(actorId, 'panne.create');
    return createPanne({ ...input, user_id: actorId });
  });
  ipcMain.handle('pannes:assign', async (_e, actorId: number, id: number, input: any) => {
    await requireRole(actorId, 'panne.assign');
    return assignPanne(id, input, actorId);
  });
  ipcMain.handle('pannes:setStatus', async (_e, actorId: number, id: number, next: PanneStatus, notes?: string) => {
    const { actor, panne } = await requirePanne(actorId, 'panne.comment', id);
    if (!canSetStatus(actor.role, panne.status, next)) throw new Error('Permission refusée : changement de statut.');
    return setPanneStatus(id, next, actorId, notes);
  });
  /** A message on the ticket's thread, optionally with a status change (how the teams respond). */
  ipcMain.handle('pannes:comment', async (_e, actorId: number, id: number, input: { body?: string; status?: PanneStatus | null }) => {
    const { actor, panne } = await requirePanne(actorId, 'panne.comment', id);
    const body = String(input?.body ?? '').trim();
    if (input?.status) {
      if (!canSetStatus(actor.role, panne.status, input.status)) throw new Error('Permission refusée : changement de statut.');
      return setPanneStatus(id, input.status, actorId, body || undefined);
    }
    if (!body) throw new Error('Le message est vide.');
    return transaction(async () => {
      await addPanneComment(id, actorId, body);
      await audit(actorId, 'panne.comment', 'panne', id);
      return await panneDetail(id);
    });
  });
  ipcMain.handle('pannes:diagnosis', async (_e, actorId: number, id: number, input: any) => {
    await requirePanne(actorId, 'panne.manage', id);
    return saveDiagnosis(id, input, actorId);
  });
  ipcMain.handle('pannes:intervention', async (_e, actorId: number, input: any) => {
    await requirePanne(actorId, 'panne.manage', input?.panne_id);
    return addIntervention({ ...input, user_id: actorId });
  });
  ipcMain.handle('pannes:costs', async (_e, actorId: number, id: number, input: any) => {
    await requirePanne(actorId, 'panne.manage', id);
    return addPanneCosts(id, input, actorId);
  });
  ipcMain.handle('pannes:addPart', async (_e, actorId: number, input: any) => {
    await requirePanne(actorId, 'panne.manage', input?.panne_id);
    return addPannePart({ ...input, user_id: actorId });
  });
  ipcMain.handle('pannes:removePart', async (_e, actorId: number, partRowId: number) => {
    const row = await get<{ panne_id: number }>('SELECT panne_id FROM panne_parts WHERE id = ?', [partRowId]);
    if (!row) throw new Error('Ligne introuvable.');
    await requirePanne(actorId, 'panne.manage', row.panne_id);
    return removePannePart(partRowId, actorId);
  });
  ipcMain.handle('pannes:addPhoto', async (_e, actorId: number, input: any) => {
    await requirePanne(actorId, 'panne.comment', input?.panne_id);
    const file_path = await storePhoto(input.file_path);
    return addPannePhoto({ ...input, file_path, user_id: actorId });
  });

  /* ---------- ARCHIVES ---------- */
  ipcMain.handle('archives:list', async (ctx) => {
    await requireRole(ctx.actorId!, 'archive.view');
    return {
      afterDays: ARCHIVE_AFTER_DAYS,
      pending: await eligibleCount(),
      archives: await all(
        `SELECT a.id, a.created_at, a.period_from, a.period_to, a.ticket_count, a.ticket_numbers, a.size_bytes, u.full_name AS created_by_name
         FROM archives a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.id DESC`
      ),
    };
  });
  ipcMain.handle('archives:download', async (ctx, id: number) => {
    await requireRole(ctx.actorId!, 'archive.view');
    const a = await get<{ created_at: string; file_name: string | null; pdf_base64: string | null }>(
      'SELECT created_at, file_name, pdf_base64 FROM archives WHERE id = ?', [id]
    );
    if (!a) throw new Error('Archive introuvable.');
    const downloadAs = `archive-tickets-${a.created_at.slice(0, 10)}-${id}.pdf`;
    if (a.file_name) return { url: await archiveDownloadUrl(a.file_name, downloadAs), name: downloadAs };
    return { url: `data:application/pdf;base64,${a.pdf_base64}`, name: downloadAs };
  });
  /** Same job as the weekly cron (api/cron-archive.ts), on demand. */
  ipcMain.handle('archives:run', async (_e, actorId: number) => {
    await requireRole(actorId, 'archive.run');
    return runArchive(actorId);
  });

  /* ---------- INVENTORY ---------- */
  ipcMain.handle('inventory:list', async () => await all('SELECT ip.*, s.name AS supplier_name FROM inventory_parts ip LEFT JOIN suppliers s ON s.id = ip.supplier_id ORDER BY ip.name'));
  ipcMain.handle('inventory:lowStock', async () => await all('SELECT ip.*, s.name AS supplier_name FROM inventory_parts ip LEFT JOIN suppliers s ON s.id = ip.supplier_id WHERE ip.quantity <= ip.min_quantity ORDER BY ip.quantity - ip.min_quantity'));
  ipcMain.handle('inventory:movements', async (_e, partId?: number) =>
    await all(
      `SELECT m.*, ip.name AS part_name, u.full_name AS user_name, p.ticket_number FROM inventory_movements m
       LEFT JOIN inventory_parts ip ON ip.id = m.part_id LEFT JOIN users u ON u.id = m.user_id LEFT JOIN pannes p ON p.id = m.panne_id
       ${partId ? 'WHERE m.part_id = ?' : ''} ORDER BY m.created_at DESC LIMIT 300`,
      partId ? [partId] : []
    )
  );
  ipcMain.handle('inventory:save', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'inventory.manage');
    if (input.id) {
      await run('UPDATE inventory_parts SET name=?, category=?, unit=?, min_quantity=?, unit_cost=?, supplier_id=?, location=?, part_number=?, notes=? WHERE id=?', [
        input.name, input.category, input.unit, input.min_quantity, input.unit_cost, input.supplier_id ?? null, input.location ?? null, input.part_number ?? null, input.notes ?? null, input.id,
      ]);
      await audit(actorId, 'inventory.update', 'inventory_part', input.id, { name: input.name });
      return { id: input.id };
    }
    const code = input.code || `PART-${Date.now().toString().slice(-6)}`;
    const { lastInsertRowid } = await run(
      'INSERT INTO inventory_parts (code, name, category, unit, quantity, min_quantity, unit_cost, supplier_id, location, part_number, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [code, input.name, input.category, input.unit || 'pièce', input.quantity ?? 0, input.min_quantity ?? 0, input.unit_cost ?? 0, input.supplier_id ?? null, input.location ?? null, input.part_number ?? null, input.notes ?? null]
    );
    await audit(actorId, 'inventory.create', 'inventory_part', lastInsertRowid, { name: input.name });
    return { id: lastInsertRowid };
  });
  ipcMain.handle('inventory:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'inventory.manage');
    const refs = (await get<{ c: number }>('SELECT COUNT(*) c FROM panne_parts WHERE part_id = ?', [id]))!.c;
    if (refs > 0) throw new Error(`Impossible de supprimer : ${refs} ligne(s) d'intervention rattachée(s).`);
    await run('DELETE FROM inventory_parts WHERE id = ? FOR UPDATE', [id]);
    await audit(actorId, 'inventory.delete', 'inventory_part', id);
  });
  ipcMain.handle('inventory:receive', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'inventory.manage');
    return receiveStock({ ...input, user_id: actorId });
  });
  ipcMain.handle('inventory:adjust', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'inventory.manage');
    return adjustStock({ ...input, user_id: actorId });
  });

  /* ---------- PURCHASE ORDERS ---------- */
  ipcMain.handle('purchaseOrders:list', async () => await all('SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC'));
  ipcMain.handle('purchaseOrders:get', async (_e, id: number) => await purchaseOrderDetail(id));
  ipcMain.handle('purchaseOrders:create', async (_e, actorId: number, input: any) => {
    await requireRole(actorId, 'purchase.manage');
    return createPurchaseOrder({ ...input, user_id: actorId });
  });
  ipcMain.handle('purchaseOrders:receive', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'purchase.manage');
    return receivePurchaseOrder(id, actorId);
  });

  /* ---------- MAINTENANCE SCHEDULES ---------- */
  const SCHEDULE_SELECT = `SELECT ms.*, e.name AS equipment_name, a.name AS area_name, b.name AS building_name, u.full_name AS assigned_to_name
    FROM maintenance_schedules ms
    LEFT JOIN equipment e ON e.id = ms.equipment_id LEFT JOIN areas a ON a.id = ms.area_id LEFT JOIN buildings b ON b.id = ms.building_id
    LEFT JOIN users u ON u.id = ms.assigned_to`;
  ipcMain.handle('maintenanceSchedules:list', async (_e, opts: { scope?: string } = {}) => {
    let where = '';
    if (opts.scope === 'overdue') where = "WHERE ms.active = 1 AND ms.next_due_date < today_txt()";
    else if (opts.scope === 'upcoming') where = "WHERE ms.active = 1 AND ms.next_due_date <= today_txt(interval '+30 days')";
    else if (opts.scope === 'active') where = 'WHERE ms.active = 1';
    return await all(`${SCHEDULE_SELECT} ${where} ORDER BY ms.next_due_date`);
  });
  ipcMain.handle('maintenanceSchedules:completions', async (_e, scheduleId: number) => await all('SELECT mc.*, u.full_name AS user_name FROM maintenance_completions mc LEFT JOIN users u ON u.id = mc.user_id WHERE mc.schedule_id = ? ORDER BY mc.completed_at DESC', [scheduleId]));
  ipcMain.handle('maintenanceSchedules:save', async (_e, actorId: number, id: number | null, input: any) => {
    await requireRole(actorId, 'maintenance.manage');
    return saveMaintenanceSchedule(id, { ...input, user_id: actorId });
  });
  ipcMain.handle('maintenanceSchedules:delete', async (_e, actorId: number, id: number) => {
    await requireRole(actorId, 'maintenance.manage');
    await run('DELETE FROM maintenance_completions WHERE schedule_id = ?', [id]);
    await run('DELETE FROM maintenance_schedules WHERE id = ?', [id]);
    await audit(actorId, 'maintenance_schedule.delete', 'maintenance_schedule', id);
  });
  ipcMain.handle('maintenanceSchedules:complete', async (_e, actorId: number, id: number, input: any) => {
    await requireRole(actorId, 'maintenance.manage');
    return completeMaintenanceSchedule(id, input, actorId);
  });

  /* ---------- SHIFT HANDOVER ---------- */
  ipcMain.handle('handovers:list', async (_e, limit = 20) => await all('SELECT h.*, u.full_name AS user_name FROM shift_handovers h LEFT JOIN users u ON u.id = h.created_by ORDER BY h.created_at DESC LIMIT ?', [limit]));
  ipcMain.handle('handovers:add', async (_e, actorId: number, input: any) => addShiftHandover({ ...input, user_id: actorId }));

  /* ---------- DASHBOARD ---------- */
  ipcMain.handle('dashboard:summary', async (ctx) => dashboardSummary(await actorOf(ctx.actorId)));

  /* ---------- REPORTS ---------- */
  ipcMain.handle('reports:frequency', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportFrequency(from, to); });
  ipcMain.handle('reports:rooms', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportRooms(from, to); });
  ipcMain.handle('reports:equipment', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportEquipment(from, to); });
  ipcMain.handle('reports:costs', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportCosts(from, to); });
  ipcMain.handle('reports:technicians', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportTechnicianPerformance(from, to); });
  ipcMain.handle('reports:resolutionTime', async (_e, actorId: number, from: string, to: string) => { await requireRole(actorId, 'reports.view'); return reportResolutionTime(from, to); });
  ipcMain.handle('reports:auditLog', async (_e, actorId: number, limit = 200) => {
    await requireRole(actorId, 'audit.view');
    return await all('SELECT a.*, u.full_name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT ?', [limit]);
  });
  ipcMain.handle('reports:dailyLog', async (_e, date: string) =>
    await all(`${PANNE_LIST_SELECT} WHERE substr(p.created_at, 1, 10) = substr(?::text, 1, 10) ORDER BY p.created_at`, [date])
  );

  /* ---------- SETTINGS / BACKUP ---------- */
  ipcMain.handle('settings:get', async () => await settingsMap());

  /* ---------- LIVE REFRESH ---------- */
  ipcMain.handle('sync:version', async () => (await get<{ version: number }>('SELECT version FROM app_state WHERE id = 1'))?.version ?? 0);
  ipcMain.handle('settings:set', async (_e, actorId: number, key: string, value: string) => {
    await requireRole(actorId, 'settings.manage');
    await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    await audit(actorId, 'settings.update', 'settings', null, { key, value });
  });

  async function requireAdmin(userId: number) {
    const user = await get<{ role: string; active: number }>('SELECT role, active FROM users WHERE id = ?', [userId]);
    if (!user || !user.active || user.role !== 'admin') throw new Error("Permission refusée : réservé à l'administrateur.");
  }
  ipcMain.handle('backup:create', async (_e, actorId: number) => {
    await requireAdmin(actorId);
    const data = await exportAll();
    await audit(actorId, 'backup.create', 'settings', null, {});
    return data;
  });
  ipcMain.handle('backup:restore', async (_e, actorId: number, data: any) => {
    await requireAdmin(actorId);
    await transaction(async () => {
      await restoreAll(data);
      // the restored data may not contain the caller's user row, so no FK to it
      await audit(null, 'backup.restore', 'settings', null, { by: actorId });
    });
  });
}
