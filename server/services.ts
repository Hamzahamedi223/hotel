import { all, get, run, transaction } from './db.js';
import { round2, addToDate } from '../shared/calc.js';
import { OPEN_PANNE_STATUSES } from '../shared/types.js';
import type { PanneStatus } from '../shared/types.js';

/* ---------- shared helpers ------------------------------------------------ */

export async function audit(userId: number | null, action: string, entityType: string | null, entityId: number | null, details?: unknown) {
  await run('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)', [
    userId,
    action,
    entityType,
    entityId,
    details ? JSON.stringify(details) : null,
  ]);
}

export async function settingsMap(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function nextNumber(prefix: string, table: string, column: string): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like = `${prefix}-${ymd}-%`;
  await run('SELECT pg_advisory_xact_lock(hashtext(?))', [table]);
  const count = (await get<{ c: number }>(`SELECT COUNT(*) as c FROM ${table} WHERE ${column} ILIKE ?`, [like]))!.c;
  return `${prefix}-${ymd}-${String(count + 1).padStart(4, '0')}`;
}

/* ---------- panne detail read ------------------------------------------- */

const PANNE_SELECT = `SELECT p.*,
    r.room_number AS room_number, r.floor AS room_floor, b1.name AS room_building_name,
    a.name AS area_name, b2.name AS area_building_name,
    b3.name AS building_name,
    e.name AS equipment_name, e.code AS equipment_code,
    ru.full_name AS reported_by_name,
    au.full_name AS assigned_to_name,
    c.company AS contractor_name
  FROM pannes p
  LEFT JOIN rooms r ON r.id = p.room_id
  LEFT JOIN buildings b1 ON b1.id = r.building_id
  LEFT JOIN areas a ON a.id = p.area_id
  LEFT JOIN buildings b2 ON b2.id = a.building_id
  LEFT JOIN buildings b3 ON b3.id = p.building_id
  LEFT JOIN equipment e ON e.id = p.equipment_id
  LEFT JOIN users ru ON ru.id = p.reported_by_user_id
  LEFT JOIN users au ON au.id = p.assigned_to
  LEFT JOIN contractors c ON c.id = p.contractor_id`;

function withLocationLabel(row: any) {
  if (!row) return row;
  const room_label = row.room_number ? `${row.room_number}${row.room_building_name ? ' — ' + row.room_building_name : ''}` : null;
  return { ...row, room_label };
}

export async function panneDetail(id: number) {
  const panne = withLocationLabel(await get<any>(`${PANNE_SELECT} WHERE p.id = ?`, [id]));
  if (!panne) throw new Error('Ticket introuvable.');
  const interventions = await all<any>(
    `SELECT i.*, u.full_name AS technician_name FROM panne_interventions i LEFT JOIN users u ON u.id = i.technician_id
     WHERE i.panne_id = ? ORDER BY i.id DESC`,
    [id]
  );
  const parts = await all<any>(
    `SELECT pp.*, ip.name AS part_name FROM panne_parts pp LEFT JOIN inventory_parts ip ON ip.id = pp.part_id
     WHERE pp.panne_id = ? ORDER BY pp.id`,
    [id]
  );
  const photos = await all<any>('SELECT * FROM panne_photos WHERE panne_id = ? ORDER BY id', [id]);
  return { panne, interventions, parts, photos };
}

/* ---------- room / equipment status side-effects ------------------------ */

async function setRoomStatus(roomId: number, status: string) {
  await run('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
}

async function setEquipmentStatus(equipmentId: number, status: string) {
  await run("UPDATE equipment SET status = ?, updated_at = now_txt() WHERE id = ?", [status, equipmentId]);
}

async function roomHasOtherOpenPannes(roomId: number, excludePanneId: number): Promise<boolean> {
  const placeholders = OPEN_PANNE_STATUSES.map(() => '?').join(',');
  return (
    (await get<{ c: number }>(`SELECT COUNT(*) c FROM pannes WHERE room_id = ? AND id != ? AND status IN (${placeholders})`, [
      roomId,
      excludePanneId,
      ...OPEN_PANNE_STATUSES,
    ]))!.c > 0
  );
}

async function equipmentHasOtherOpenPannes(equipmentId: number, excludePanneId: number): Promise<boolean> {
  const placeholders = OPEN_PANNE_STATUSES.map(() => '?').join(',');
  return (
    (await get<{ c: number }>(`SELECT COUNT(*) c FROM pannes WHERE equipment_id = ? AND id != ? AND status IN (${placeholders})`, [
      equipmentId,
      excludePanneId,
      ...OPEN_PANNE_STATUSES,
    ]))!.c > 0
  );
}

/** A newly reported problem takes the room out of service when it makes the room unusable, or blocks the whole hotel/critical-severity. */
function shouldTakeRoomOutOfService(input: { priority: string; guest_impact: string }): boolean {
  return input.guest_impact === 'room_unusable' || input.guest_impact === 'hotel_wide' || input.priority === 'critical';
}

/* ---------- panne lifecycle ---------------------------------------------- */

export interface PanneInput {
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  guest_impact: string;
  location_type: 'room' | 'area' | 'building';
  room_id?: number | null;
  area_id?: number | null;
  building_id?: number | null;
  equipment_id?: number | null;
  reported_by_role?: string | null;
  notes?: string | null;
  assigned_to?: number | null;
  contractor_id?: number | null;
  user_id: number;
}

export async function createPanne(input: PanneInput) {
  return transaction(async () => {
    const number = await nextNumber('PANNE', 'pannes', 'ticket_number');
    const status: PanneStatus = input.assigned_to || input.contractor_id ? 'assigned' : 'open';
    const { lastInsertRowid: id } = await run(
      `INSERT INTO pannes
        (ticket_number, title, description, category, priority, guest_impact, location_type,
         room_id, area_id, building_id, equipment_id, reported_by_user_id, reported_by_role,
         status, assigned_to, contractor_id, notes, assigned_at)
       VALUES (?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?, ?)`,
      [
        number, input.title, input.description ?? null, input.category, input.priority, input.guest_impact, input.location_type,
        input.room_id ?? null, input.area_id ?? null, input.building_id ?? null, input.equipment_id ?? null,
        input.user_id, input.reported_by_role ?? null,
        status, input.assigned_to ?? null, input.contractor_id ?? null, input.notes ?? null,
        status === 'assigned' ? new Date().toISOString() : null,
      ]
    );
    if (input.room_id && shouldTakeRoomOutOfService(input)) await setRoomStatus(input.room_id, 'maintenance');
    if (input.equipment_id) await setEquipmentStatus(input.equipment_id, 'needs_repair');
    await audit(input.user_id, 'panne.create', 'panne', id, { number, title: input.title, priority: input.priority });
    return await panneDetail(id);
  });
}

export async function assignPanne(id: number, input: { assigned_to?: number | null; contractor_id?: number | null }, actorId: number) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [id]);
    if (!p) throw new Error('Ticket introuvable.');
    if (['resolved', 'closed', 'cancelled'].includes(p.status)) throw new Error('Ce ticket est déjà terminé.');
    const nextStatus = p.status === 'open' ? 'assigned' : p.status;
    await run("UPDATE pannes SET assigned_to = ?, contractor_id = ?, status = ?, assigned_at = COALESCE(assigned_at, now_txt()), updated_at = now_txt() WHERE id = ?", [
      input.assigned_to ?? null, input.contractor_id ?? null, nextStatus, id,
    ]);
    await audit(actorId, 'panne.assign', 'panne', id, { number: p.ticket_number, assigned_to: input.assigned_to, contractor_id: input.contractor_id });
    return await panneDetail(id);
  });
}

const ALLOWED_TRANSITIONS: Record<PanneStatus, PanneStatus[]> = {
  open: ['assigned', 'diagnosis', 'cancelled'],
  assigned: ['diagnosis', 'waiting_parts', 'in_repair', 'cancelled'],
  diagnosis: ['waiting_parts', 'in_repair', 'cancelled'],
  waiting_parts: ['diagnosis', 'in_repair', 'cancelled'],
  in_repair: ['waiting_parts', 'testing', 'cancelled'],
  testing: ['in_repair', 'resolved', 'cancelled'],
  resolved: ['in_repair', 'closed'],
  closed: ['open'],
  cancelled: ['open'],
};

export async function setPanneStatus(id: number, next: PanneStatus, actorId: number, notes?: string) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [id]);
    if (!p) throw new Error('Ticket introuvable.');
    const allowed = ALLOWED_TRANSITIONS[p.status as PanneStatus] ?? [];
    if (!allowed.includes(next)) throw new Error(`Transition ${p.status} → ${next} non permise.`);

    const sets = ['status = ?', "updated_at = now_txt()"];
    const params: any[] = [next];
    if (next === 'resolved') {
      sets.push('resolved_at = now_txt()');
    }
    if (next === 'closed') {
      sets.push('closed_at = now_txt()');
    }
    if (notes) {
      sets.push("notes = COALESCE(notes,'') || ?");
      params.push(`\n[${next}] ${notes}`);
    }
    await run(`UPDATE pannes SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

    if (['resolved', 'closed', 'cancelled'].includes(next)) {
      if (p.room_id && !await roomHasOtherOpenPannes(p.room_id, id)) {
        const room = await get<{ status: string }>('SELECT status FROM rooms WHERE id = ?', [p.room_id]);
        if (room?.status === 'maintenance') await setRoomStatus(p.room_id, 'available');
      }
      if (p.equipment_id && !await equipmentHasOtherOpenPannes(p.equipment_id, id)) {
        const eq = await get<{ status: string }>('SELECT status FROM equipment WHERE id = ?', [p.equipment_id]);
        if (eq?.status === 'needs_repair') await setEquipmentStatus(p.equipment_id, 'operational');
      }
    }
    if (next === 'open' && p.room_id && shouldTakeRoomOutOfService(p)) await setRoomStatus(p.room_id, 'maintenance');
    if (next === 'open' && p.equipment_id) await setEquipmentStatus(p.equipment_id, 'needs_repair');

    await audit(actorId, `panne.${next}`, 'panne', id, { number: p.ticket_number });
    return await panneDetail(id);
  });
}

export async function saveDiagnosis(id: number, input: { diagnosis?: string; cause?: string; recommended_action?: string }, actorId: number) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [id]);
    if (!p) throw new Error('Ticket introuvable.');
    await run("UPDATE pannes SET diagnosis = ?, cause = ?, recommended_action = ?, updated_at = now_txt() WHERE id = ?", [
      input.diagnosis ?? null, input.cause ?? null, input.recommended_action ?? null, id,
    ]);
    if (p.status === 'open' || p.status === 'assigned') {
      await run("UPDATE pannes SET status = 'diagnosis' WHERE id = ?", [id]);
    }
    await audit(actorId, 'panne.diagnosis', 'panne', id, { number: p.ticket_number });
    return await panneDetail(id);
  });
}

export interface InterventionInput {
  panne_id: number;
  technician_id?: number | null;
  description?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  result?: string | null;
  user_id: number;
}

export async function addIntervention(input: InterventionInput) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [input.panne_id]);
    if (!p) throw new Error('Ticket introuvable.');
    await run(
      `INSERT INTO panne_interventions (panne_id, technician_id, description, started_at, finished_at, result)
       VALUES (?,?,?,?,?,?)`,
      [input.panne_id, input.technician_id ?? null, input.description ?? null, input.started_at ?? null, input.finished_at ?? null, input.result ?? null]
    );
    if (['open', 'assigned', 'diagnosis', 'waiting_parts'].includes(p.status)) {
      await run("UPDATE pannes SET status = 'in_repair', updated_at = now_txt() WHERE id = ?", [input.panne_id]);
    }
    await audit(input.user_id, 'panne.intervention', 'panne', input.panne_id, { number: p.ticket_number });
    return await panneDetail(input.panne_id);
  });
}

async function recomputePanneCosts(panneId: number) {
  const partsCost = (await get<{ s: number }>('SELECT COALESCE(SUM(amount),0) s FROM panne_parts WHERE panne_id = ?', [panneId]))!.s;
  const p = (await get<{ labor_cost: number; contractor_cost: number }>('SELECT labor_cost, contractor_cost FROM pannes WHERE id = ?', [panneId]))!;
  const total = round2(partsCost + p.labor_cost + p.contractor_cost);
  await run('UPDATE pannes SET parts_cost = ?, total_cost = ? WHERE id = ?', [round2(partsCost), total, panneId]);
}

export async function addPanneCosts(id: number, input: { labor_cost?: number; contractor_cost?: number }, actorId: number) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [id]);
    if (!p) throw new Error('Ticket introuvable.');
    await run('UPDATE pannes SET labor_cost = ?, contractor_cost = ? WHERE id = ?', [
      input.labor_cost != null ? round2(input.labor_cost) : p.labor_cost,
      input.contractor_cost != null ? round2(input.contractor_cost) : p.contractor_cost,
      id,
    ]);
    await recomputePanneCosts(id);
    await audit(actorId, 'panne.costs', 'panne', id, input);
    return await panneDetail(id);
  });
}

export interface PannePartInput {
  panne_id: number;
  part_id?: number | null;
  label: string;
  qty: number;
  unit_cost: number;
  user_id: number;
}

export async function addPannePart(input: PannePartInput) {
  return transaction(async () => {
    const p = await get<any>('SELECT * FROM pannes WHERE id = ?', [input.panne_id]);
    if (!p) throw new Error('Ticket introuvable.');
    const amount = round2(input.qty * input.unit_cost);
    await run('INSERT INTO panne_parts (panne_id, part_id, label, qty, unit_cost, amount) VALUES (?,?,?,?,?,?)', [
      input.panne_id, input.part_id ?? null, input.label, input.qty, input.unit_cost, amount,
    ]);
    if (input.part_id) {
      const part = await get<{ quantity: number; name: string }>('SELECT quantity, name FROM inventory_parts WHERE id = ? FOR UPDATE', [input.part_id]);
      if (part) {
        await run('UPDATE inventory_parts SET quantity = ? WHERE id = ?', [round2(part.quantity - input.qty), input.part_id]);
        await run('INSERT INTO inventory_movements (part_id, type, qty, reason, panne_id, user_id) VALUES (?,?,?,?,?,?)', [
          input.part_id, 'out', input.qty, `Utilisé sur ${p.ticket_number}`, input.panne_id, input.user_id,
        ]);
      }
    }
    await recomputePanneCosts(input.panne_id);
    await audit(input.user_id, 'panne.part.add', 'panne', input.panne_id, { label: input.label, qty: input.qty });
    return await panneDetail(input.panne_id);
  });
}

export async function removePannePart(partRowId: number, actorId: number) {
  return transaction(async () => {
    const row = await get<any>('SELECT * FROM panne_parts WHERE id = ?', [partRowId]);
    if (!row) throw new Error('Ligne introuvable.');
    if (row.part_id) {
      const part = await get<{ quantity: number }>('SELECT quantity FROM inventory_parts WHERE id = ? FOR UPDATE', [row.part_id]);
      if (part) {
        await run('UPDATE inventory_parts SET quantity = ? WHERE id = ?', [round2(part.quantity + row.qty), row.part_id]);
        await run('INSERT INTO inventory_movements (part_id, type, qty, reason, panne_id, user_id) VALUES (?,?,?,?,?,?)', [
          row.part_id, 'in', row.qty, 'Retrait — ligne annulée', row.panne_id, actorId,
        ]);
      }
    }
    await run('DELETE FROM panne_parts WHERE id = ?', [partRowId]);
    await recomputePanneCosts(row.panne_id);
    await audit(actorId, 'panne.part.remove', 'panne', row.panne_id, { label: row.label });
    return await panneDetail(row.panne_id);
  });
}

export async function addPannePhoto(input: { panne_id: number; file_path: string; caption?: string | null; stage: string; user_id: number }) {
  return transaction(async () => {
    await run('INSERT INTO panne_photos (panne_id, file_path, caption, stage) VALUES (?,?,?,?)', [
      input.panne_id, input.file_path, input.caption ?? null, input.stage,
    ]);
    await audit(input.user_id, 'panne.photo.add', 'panne', input.panne_id, {});
    return await panneDetail(input.panne_id);
  });
}

/* ---------- rooms / equipment history ------------------------------------ */

export async function roomHistory(roomId: number) {
  return {
    pannes: await all<any>(`${PANNE_SELECT} WHERE p.room_id = ? ORDER BY p.created_at DESC`, [roomId]),
    equipment: await all<any>('SELECT * FROM equipment WHERE room_id = ? ORDER BY name', [roomId]),
  };
}

export async function equipmentHistory(equipmentId: number) {
  return {
    pannes: await all<any>(`${PANNE_SELECT} WHERE p.equipment_id = ? ORDER BY p.created_at DESC`, [equipmentId]),
    maintenance: await all<any>(
      `SELECT mc.*, ms.title AS schedule_title FROM maintenance_completions mc
       JOIN maintenance_schedules ms ON ms.id = mc.schedule_id
       WHERE ms.equipment_id = ? ORDER BY mc.completed_at DESC`,
      [equipmentId]
    ),
  };
}

/* ---------- inventory ------------------------------------------------------ */

export async function receiveStock(input: { part_id: number; qty: number; unit_cost?: number; reason?: string; user_id: number }) {
  return transaction(async () => {
    const part = await get<any>('SELECT * FROM inventory_parts WHERE id = ? FOR UPDATE', [input.part_id]);
    if (!part) throw new Error('Pièce introuvable.');
    const sets = ['quantity = ?'];
    const params: any[] = [round2(part.quantity + input.qty)];
    if (input.unit_cost != null) {
      sets.push('unit_cost = ?');
      params.push(input.unit_cost);
    }
    await run(`UPDATE inventory_parts SET ${sets.join(', ')} WHERE id = ?`, [...params, input.part_id]);
    await run('INSERT INTO inventory_movements (part_id, type, qty, reason, user_id) VALUES (?,?,?,?,?)', [
      input.part_id, 'in', input.qty, input.reason ?? 'Réception', input.user_id,
    ]);
    await audit(input.user_id, 'inventory.receive', 'inventory_part', input.part_id, { qty: input.qty });
    return await get('SELECT * FROM inventory_parts WHERE id = ?', [input.part_id]);
  });
}

export async function adjustStock(input: { part_id: number; qty: number; reason: string; user_id: number }) {
  return transaction(async () => {
    const part = await get<any>('SELECT * FROM inventory_parts WHERE id = ? FOR UPDATE', [input.part_id]);
    if (!part) throw new Error('Pièce introuvable.');
    await run('UPDATE inventory_parts SET quantity = ? WHERE id = ?', [round2(part.quantity + input.qty), input.part_id]);
    await run('INSERT INTO inventory_movements (part_id, type, qty, reason, user_id) VALUES (?,?,?,?,?)', [
      input.part_id, 'adjust', input.qty, input.reason, input.user_id,
    ]);
    await audit(input.user_id, 'inventory.adjust', 'inventory_part', input.part_id, { qty: input.qty, reason: input.reason });
    return await get('SELECT * FROM inventory_parts WHERE id = ?', [input.part_id]);
  });
}

/* ---------- purchase orders ------------------------------------------------ */

export interface PurchaseOrderInput {
  supplier_id?: number | null;
  status?: 'draft' | 'ordered';
  notes?: string | null;
  lines: Array<{ part_id?: number | null; label: string; qty: number; unit_cost: number }>;
  user_id: number;
}

export async function createPurchaseOrder(input: PurchaseOrderInput) {
  return transaction(async () => {
    const number = await nextNumber('PO', 'purchase_orders', 'po_number');
    const { lastInsertRowid: id } = await run('INSERT INTO purchase_orders (po_number, supplier_id, status, created_by, notes) VALUES (?,?,?,?,?)', [
      number, input.supplier_id ?? null, input.status ?? 'draft', input.user_id, input.notes ?? null,
    ]);
    for (const l of input.lines) {
      await run('INSERT INTO purchase_order_lines (po_id, part_id, label, qty, unit_cost, amount) VALUES (?,?,?,?,?,?)', [
        id, l.part_id ?? null, l.label, l.qty, l.unit_cost, round2(l.qty * l.unit_cost),
      ]);
    }
    await audit(input.user_id, 'purchase_order.create', 'purchase_order', id, { number });
    return await purchaseOrderDetail(id);
  });
}

export async function purchaseOrderDetail(id: number) {
  const po = await get<any>(
    `SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`,
    [id]
  );
  const lines = await all<any>('SELECT * FROM purchase_order_lines WHERE po_id = ? ORDER BY id', [id]);
  return { po, lines };
}

export async function receivePurchaseOrder(id: number, actorId: number) {
  return transaction(async () => {
    const po = await get<any>('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    if (!po) throw new Error('Bon de commande introuvable.');
    if (po.status === 'received') throw new Error('Déjà réceptionné.');
    const lines = await all<any>('SELECT * FROM purchase_order_lines WHERE po_id = ?', [id]);
    for (const l of lines) {
      if (!l.part_id) continue;
      const part = await get<{ quantity: number }>('SELECT quantity FROM inventory_parts WHERE id = ? FOR UPDATE', [l.part_id]);
      if (!part) continue;
      await run('UPDATE inventory_parts SET quantity = ?, unit_cost = ? WHERE id = ?', [round2(part.quantity + l.qty), l.unit_cost, l.part_id]);
      await run('INSERT INTO inventory_movements (part_id, type, qty, reason, purchase_order_id, user_id) VALUES (?,?,?,?,?,?)', [
        l.part_id, 'in', l.qty, `Réception ${po.po_number}`, id, actorId,
      ]);
    }
    await run("UPDATE purchase_orders SET status = 'received', received_at = now_txt() WHERE id = ?", [id]);
    await audit(actorId, 'purchase_order.receive', 'purchase_order', id, { number: po.po_number });
    return await purchaseOrderDetail(id);
  });
}

/* ---------- preventive maintenance ----------------------------------------- */

export interface MaintenanceScheduleInput {
  title: string;
  equipment_id?: number | null;
  area_id?: number | null;
  building_id?: number | null;
  frequency_type: 'days' | 'weeks' | 'months';
  frequency_value: number;
  checklist?: string[] | null;
  assigned_to?: number | null;
  next_due_date?: string;
  notes?: string | null;
  active?: boolean;
  user_id: number;
}

export async function saveMaintenanceSchedule(id: number | null, input: MaintenanceScheduleInput) {
  return transaction(async () => {
    const checklistJson = input.checklist && input.checklist.length ? JSON.stringify(input.checklist) : null;
    if (id) {
      await run(
        `UPDATE maintenance_schedules SET title=?, equipment_id=?, area_id=?, building_id=?, frequency_type=?, frequency_value=?,
           checklist=?, assigned_to=?, next_due_date=?, notes=?, active=? WHERE id=?`,
        [
          input.title, input.equipment_id ?? null, input.area_id ?? null, input.building_id ?? null,
          input.frequency_type, input.frequency_value, checklistJson, input.assigned_to ?? null,
          input.next_due_date ?? new Date().toISOString().slice(0, 10), input.notes ?? null, input.active === false ? 0 : 1, id,
        ]
      );
      await audit(input.user_id, 'maintenance_schedule.update', 'maintenance_schedule', id, { title: input.title });
      return id;
    }
    const { lastInsertRowid } = await run(
      `INSERT INTO maintenance_schedules (title, equipment_id, area_id, building_id, frequency_type, frequency_value, checklist, assigned_to, next_due_date, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        input.title, input.equipment_id ?? null, input.area_id ?? null, input.building_id ?? null,
        input.frequency_type, input.frequency_value, checklistJson, input.assigned_to ?? null,
        input.next_due_date ?? new Date().toISOString().slice(0, 10), input.notes ?? null,
      ]
    );
    await audit(input.user_id, 'maintenance_schedule.create', 'maintenance_schedule', lastInsertRowid, { title: input.title });
    return lastInsertRowid;
  });
}

export async function completeMaintenanceSchedule(
  id: number,
  input: { checklist_results?: Record<string, string>; notes?: string; cost?: number },
  actorId: number
) {
  return transaction(async () => {
    const schedule = await get<any>('SELECT * FROM maintenance_schedules WHERE id = ?', [id]);
    if (!schedule) throw new Error('Échéance introuvable.');
    await run('INSERT INTO maintenance_completions (schedule_id, user_id, checklist_results, notes, cost) VALUES (?,?,?,?,?)', [
      id, actorId, input.checklist_results ? JSON.stringify(input.checklist_results) : null, input.notes ?? null, round2(input.cost ?? 0),
    ]);
    const nextDue = addToDate(new Date().toISOString(), schedule.frequency_type, schedule.frequency_value);
    await run("UPDATE maintenance_schedules SET last_completed_at = now_txt(), next_due_date = ? WHERE id = ?", [nextDue, id]);
    await audit(actorId, 'maintenance_schedule.complete', 'maintenance_schedule', id, { title: schedule.title, next_due: nextDue });
    return await get('SELECT * FROM maintenance_schedules WHERE id = ?', [id]);
  });
}

/* ---------- shift handover -------------------------------------------------- */

export async function addShiftHandover(input: { shift: string; notes: string; user_id: number }) {
  const { lastInsertRowid } = await run('INSERT INTO shift_handovers (shift, notes, created_by) VALUES (?,?,?)', [input.shift, input.notes, input.user_id]);
  await audit(input.user_id, 'handover.add', 'shift_handover', lastInsertRowid, {});
  return { id: lastInsertRowid };
}

/* ---------- dashboard -------------------------------------------------------- */

export async function dashboardSummary() {
  const byStatus = await all<{ status: string; c: number }>('SELECT status, COUNT(*) c FROM pannes GROUP BY status');
  const statusMap: Record<string, number> = {};
  for (const r of byStatus) statusMap[r.status] = r.c;

  const openCount = OPEN_PANNE_STATUSES.reduce((s, k) => s + (statusMap[k] ?? 0), 0);
  const criticalOpen = (await get<{ c: number }>(
    `SELECT COUNT(*) c FROM pannes WHERE priority = 'critical' AND status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')})`,
    OPEN_PANNE_STATUSES
  ))!.c;
  const highOpen = (await get<{ c: number }>(
    `SELECT COUNT(*) c FROM pannes WHERE priority = 'high' AND status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')})`,
    OPEN_PANNE_STATUSES
  ))!.c;
  const resolvedToday = (await get<{ c: number }>("SELECT COUNT(*) c FROM pannes WHERE substr(resolved_at, 1, 10) = today_txt()"))!.c;
  const inProgress = (statusMap['in_repair'] ?? 0) + (statusMap['testing'] ?? 0) + (statusMap['diagnosis'] ?? 0);

  const roomsWithProblems = (await get<{ c: number }>(
    `SELECT COUNT(DISTINCT room_id) c FROM pannes WHERE room_id IS NOT NULL AND status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')})`,
    OPEN_PANNE_STATUSES
  ))!.c;
  const roomsOutOfService = (await get<{ c: number }>("SELECT COUNT(*) c FROM rooms WHERE status IN ('maintenance','out_of_service')"))!.c;

  const overdueMaintenance = (await get<{ c: number }>("SELECT COUNT(*) c FROM maintenance_schedules WHERE active = 1 AND next_due_date < today_txt()"))!.c;
  const dueSoonMaintenance = await all<any>(
    `SELECT ms.*, e.name AS equipment_name, a.name AS area_name, b.name AS building_name
     FROM maintenance_schedules ms
     LEFT JOIN equipment e ON e.id = ms.equipment_id LEFT JOIN areas a ON a.id = ms.area_id LEFT JOIN buildings b ON b.id = ms.building_id
     WHERE ms.active = 1 AND ms.next_due_date <= today_txt(interval '+7 days') ORDER BY ms.next_due_date LIMIT 12`
  );

  const recentTickets = await all<any>(`${PANNE_SELECT} WHERE p.status IN (${OPEN_PANNE_STATUSES.map(() => '?').join(',')}) ORDER BY
    CASE p.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, p.created_at DESC LIMIT 10`, OPEN_PANNE_STATUSES);

  const recurring = await all<any>(
    `SELECT p.room_id, r.room_number, COUNT(*) c FROM pannes p JOIN rooms r ON r.id = p.room_id
     WHERE p.room_id IS NOT NULL AND p.created_at >= now_txt(interval '-90 days') GROUP BY p.room_id, r.room_number HAVING COUNT(*) >= 3 ORDER BY c DESC LIMIT 6`
  );

  return {
    statusMap, openCount, criticalOpen, highOpen, resolvedToday, inProgress,
    roomsWithProblems, roomsOutOfService, overdueMaintenance, dueSoonMaintenance,
    recentTickets, recurring,
  };
}

/* ---------- reports ----------------------------------------------------------- */

export async function reportFrequency(from: string, to: string) {
  return await all(`SELECT category, COUNT(*) c FROM pannes WHERE created_at BETWEEN ? AND ? GROUP BY category ORDER BY c DESC`, [from, to]);
}

export async function reportRooms(from: string, to: string) {
  return await all(
    `SELECT r.room_number, b.name AS building_name, COUNT(*) c
     FROM pannes p JOIN rooms r ON r.id = p.room_id LEFT JOIN buildings b ON b.id = r.building_id
     WHERE p.created_at BETWEEN ? AND ? GROUP BY r.id, b.name ORDER BY c DESC LIMIT 20`,
    [from, to]
  );
}

export async function reportEquipment(from: string, to: string) {
  return await all(
    `SELECT e.code, e.name, COUNT(*) c, COALESCE(SUM(p.total_cost),0) total_cost
     FROM pannes p JOIN equipment e ON e.id = p.equipment_id
     WHERE p.created_at BETWEEN ? AND ? GROUP BY e.id ORDER BY c DESC LIMIT 20`,
    [from, to]
  );
}

export async function reportCosts(from: string, to: string) {
  const byCategory = await all(
    `SELECT category, COALESCE(SUM(parts_cost),0) parts, COALESCE(SUM(labor_cost),0) labor, COALESCE(SUM(contractor_cost),0) contractor, COALESCE(SUM(total_cost),0) total
     FROM pannes WHERE created_at BETWEEN ? AND ? GROUP BY category ORDER BY total DESC`,
    [from, to]
  );
  const totals = await get<any>(
    `SELECT COALESCE(SUM(parts_cost),0) parts, COALESCE(SUM(labor_cost),0) labor, COALESCE(SUM(contractor_cost),0) contractor, COALESCE(SUM(total_cost),0) total, COUNT(*) n
     FROM pannes WHERE created_at BETWEEN ? AND ?`,
    [from, to]
  );
  return { byCategory, totals };
}

export async function reportTechnicianPerformance(from: string, to: string) {
  return await all(
    `SELECT u.id, u.full_name,
       SUM(CASE WHEN p.status IN ('resolved','closed') THEN 1 ELSE 0 END) resolved_count,
       COUNT(*) total_assigned,
       AVG(CASE WHEN p.resolved_at IS NOT NULL THEN hours_between(p.created_at, p.resolved_at) END) avg_resolution_hours
     FROM pannes p JOIN users u ON u.id = p.assigned_to
     WHERE p.created_at BETWEEN ? AND ? GROUP BY u.id ORDER BY resolved_count DESC`,
    [from, to]
  );
}

export async function reportResolutionTime(from: string, to: string) {
  return await get(
    `SELECT COUNT(*) n, AVG(hours_between(created_at, resolved_at)) avg_hours,
       AVG(CASE WHEN assigned_at IS NOT NULL THEN hours_between(created_at, assigned_at) * 60 END) avg_response_minutes
     FROM pannes WHERE resolved_at IS NOT NULL AND created_at BETWEEN ? AND ?`,
    [from, to]
  );
}
