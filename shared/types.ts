export type UserRole = 'admin' | 'manager' | 'reception' | 'housekeeping' | 'technician' | 'it';

export const USER_ROLES: UserRole[] = ['admin', 'manager', 'reception', 'housekeeping', 'technician', 'it'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Responsable maintenance',
  reception: 'Réception',
  housekeeping: 'Housekeeping',
  technician: 'Technicien maintenance',
  it: 'Informatique (IT)',
};

/** The team a ticket is routed to. */
export type Department = 'maintenance' | 'it';

export const DEPARTMENT_LABELS: Record<Department, string> = {
  maintenance: 'Maintenance',
  it: 'Informatique (IT)',
};

/** Roles that work tickets for one department only: they see that department's tickets (plus any assigned to them) and respond to them. */
export const ROLE_DEPARTMENT: Partial<Record<UserRole, Department>> = {
  technician: 'maintenance',
  it: 'it',
};

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  active: number;
}

export interface Building {
  id: number;
  name: string;
  active: number;
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'out_of_service';

export interface Room {
  id: number;
  building_id: number | null;
  building_name?: string;
  floor: string | null;
  room_number: string;
  room_type: string | null;
  status: RoomStatus;
  notes: string | null;
  created_at: string;
  open_pannes?: number;
}

export interface Area {
  id: number;
  building_id: number | null;
  building_name?: string;
  name: string;
  area_type: string;
  notes: string | null;
}

export type EquipmentCategory =
  | 'ac' | 'elevator' | 'generator' | 'pump' | 'boiler' | 'refrigerator' | 'freezer'
  | 'washing_machine' | 'dryer' | 'kitchen_equipment' | 'tv' | 'safe' | 'fire_system'
  | 'electrical' | 'plumbing' | 'furniture' | 'other';

export type EquipmentStatus = 'operational' | 'needs_repair' | 'out_of_service';

export interface Equipment {
  id: number;
  code: string;
  name: string;
  category: EquipmentCategory;
  room_id: number | null;
  room_label?: string;
  area_id: number | null;
  area_name?: string;
  building_id: number | null;
  building_name?: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  status: EquipmentStatus;
  notes: string | null;
  created_at: string;
}

export interface Contractor {
  id: number;
  company: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  service_type: string | null;
  contract_info: string | null;
  rate: number | null;
  notes: string | null;
  active: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: number;
}

export type PanneCategory =
  | 'electrical' | 'ac' | 'plumbing' | 'heating' | 'room_equipment' | 'building' | 'housekeeping'
  | 'network' | 'computer' | 'telephony' | 'tv_system' | 'other';

export type PannePriority = 'critical' | 'high' | 'medium' | 'low';

export type GuestImpact = 'none' | 'minor' | 'significant' | 'room_unusable' | 'hotel_wide';

export type PanneStatus =
  | 'open' | 'assigned' | 'diagnosis' | 'waiting_parts' | 'in_repair' | 'testing' | 'need_info' | 'escalated'
  | 'resolved' | 'closed' | 'cancelled';

export interface Panne {
  id: number;
  ticket_number: string;
  title: string;
  description: string | null;
  category: PanneCategory;
  priority: PannePriority;
  guest_impact: GuestImpact;
  location_type: 'room' | 'area' | 'building';
  room_id: number | null;
  room_label?: string;
  area_id: number | null;
  area_name?: string;
  building_id: number | null;
  building_name?: string;
  equipment_id: number | null;
  equipment_name?: string;
  reported_by_user_id: number | null;
  reported_by_name?: string;
  reported_by_role: string | null;
  department: Department;
  status: PanneStatus;
  assigned_to: number | null;
  assigned_to_name?: string;
  contractor_id: number | null;
  contractor_name?: string;
  diagnosis: string | null;
  cause: string | null;
  recommended_action: string | null;
  parts_cost: number;
  labor_cost: number;
  contractor_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface PanneIntervention {
  id: number;
  panne_id: number;
  technician_id: number | null;
  technician_name?: string;
  description: string | null;
  started_at: string | null;
  finished_at: string | null;
  result: string | null;
  created_at: string;
}

/** One message on a ticket's thread; `status` is set when the message came with a status change. */
export interface PanneComment {
  id: number;
  panne_id: number;
  user_id: number | null;
  user_name?: string;
  user_role?: UserRole;
  body: string | null;
  status: PanneStatus | null;
  created_at: string;
}

export interface PannePart {
  id: number;
  panne_id: number;
  part_id: number | null;
  label: string;
  qty: number;
  unit_cost: number;
  amount: number;
  created_at: string;
}

export interface PannePhoto {
  id: number;
  panne_id: number;
  file_path: string;
  caption: string | null;
  stage: 'before' | 'during' | 'after' | 'other';
  created_at: string;
}

export interface InventoryPart {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  unit_cost: number;
  supplier_id: number | null;
  supplier_name?: string;
  location: string | null;
  part_number: string | null;
  notes: string | null;
}

export interface MaintenanceSchedule {
  id: number;
  title: string;
  equipment_id: number | null;
  equipment_name?: string;
  area_id: number | null;
  area_name?: string;
  building_id: number | null;
  building_name?: string;
  frequency_type: 'days' | 'weeks' | 'months';
  frequency_value: number;
  checklist: string | null;
  assigned_to: number | null;
  assigned_to_name?: string;
  last_completed_at: string | null;
  next_due_date: string;
  active: number;
  notes: string | null;
  created_at: string;
}

/* ---------- Permissions ---------------------------------------------------- */

export const PERMISSIONS: Record<string, UserRole[]> = {
  /** Report a new problem. Department teams (maintenance, IT) only respond to tickets, they never open them. */
  'panne.create': ['admin', 'manager', 'reception', 'housekeeping'],
  /** See every ticket; everyone else only sees their department's (see ROLE_DEPARTMENT). */
  'panne.viewAll': ['admin', 'manager', 'reception', 'housekeeping'],
  /** Write on a ticket's thread (e.g. a reporter answering "besoin d'informations"). */
  'panne.comment': ['admin', 'manager', 'reception', 'housekeeping', 'technician', 'it'],
  /** Any status change (see canSetStatus); department teams are limited to RESPONSE_STATUSES. */
  'panne.status': ['admin', 'manager'],
  'panne.respond': ['technician', 'it'],
  'panne.assign': ['admin', 'manager'],
  /** Diagnosis, interventions, parts, costs. */
  'panne.manage': ['admin', 'manager', 'technician', 'it'],
  'panne.close': ['admin', 'manager'],
  'panne.cancel': ['admin', 'manager'],
  'room.manage': ['admin', 'manager'],
  'equipment.manage': ['admin', 'manager', 'technician'],
  'inventory.manage': ['admin', 'manager', 'technician'],
  'purchase.manage': ['admin', 'manager'],
  'maintenance.manage': ['admin', 'manager', 'technician'],
  'contractor.manage': ['admin', 'manager'],
  'reports.view': ['admin', 'manager'],
  'audit.view': ['admin', 'manager'],
  /** Weekly PDF archives of finished tickets (server/archive.ts). */
  'archive.view': ['admin', 'manager'],
  'archive.run': ['admin'],
  'user.manage': ['admin'],
  'settings.manage': ['admin'],
};

export function hasPermission(role: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Disponible',
  occupied: 'Occupée',
  maintenance: 'Maintenance',
  out_of_service: 'Hors service',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  operational: 'Opérationnel',
  needs_repair: 'À réparer',
  out_of_service: 'Hors service',
};

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  ac: 'Climatisation',
  elevator: 'Ascenseur',
  generator: 'Groupe électrogène',
  pump: 'Pompe',
  boiler: 'Chaudière',
  refrigerator: 'Réfrigérateur',
  freezer: 'Congélateur',
  washing_machine: 'Lave-linge',
  dryer: 'Sèche-linge',
  kitchen_equipment: 'Équipement cuisine',
  tv: 'Télévision',
  safe: 'Coffre-fort',
  fire_system: 'Système incendie',
  electrical: 'Électrique',
  plumbing: 'Plomberie',
  furniture: 'Mobilier',
  other: 'Autre',
};

export const PANNE_CATEGORY_LABELS: Record<PanneCategory, string> = {
  electrical: 'Électricité',
  ac: 'Climatisation',
  plumbing: 'Plomberie',
  heating: 'Chauffage',
  room_equipment: 'Équipement chambre',
  building: 'Bâtiment',
  housekeeping: 'Housekeeping',
  network: 'Wi-Fi / Réseau',
  computer: 'Informatique (PC, imprimante, caisse)',
  telephony: 'Téléphonie',
  tv_system: 'TV / IPTV',
  other: 'Autre',
};

/** Where a new ticket goes by default, from its category (the reporter can still change it). */
export function departmentForCategory(category: string): Department {
  return ['network', 'computer', 'telephony', 'tv_system'].includes(category) ? 'it' : 'maintenance';
}

export const PANNE_PRIORITY_LABELS: Record<PannePriority, string> = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Basse',
};

export const GUEST_IMPACT_LABELS: Record<GuestImpact, string> = {
  none: 'Aucun',
  minor: 'Mineur',
  significant: 'Significatif',
  room_unusable: 'Chambre inutilisable',
  hotel_wide: 'Tout l’hôtel',
};

export const PANNE_STATUS_LABELS: Record<PanneStatus, string> = {
  open: 'Ouverte',
  assigned: 'Assignée',
  diagnosis: 'Diagnostic',
  waiting_parts: 'Attente pièce / matériel',
  in_repair: 'En cours',
  testing: 'Test',
  need_info: 'Info demandée',
  escalated: 'Escaladée',
  resolved: 'Résolue',
  closed: 'Clôturée',
  cancelled: 'Annulée',
};

export const REPORTER_ROLE_LABELS: Record<string, string> = {
  reception: 'Réception',
  housekeeping: 'Housekeeping',
  guest: 'Client',
  manager: 'Direction',
  security: 'Sécurité',
  maintenance: 'Maintenance',
  restaurant: 'Restaurant',
  kitchen: 'Cuisine',
  administration: 'Administration',
};

/** Statuses of a ticket still being worked on (the room/equipment stays flagged while any is in one). */
export const OPEN_PANNE_STATUSES: PanneStatus[] = ['open', 'assigned', 'diagnosis', 'waiting_parts', 'in_repair', 'testing', 'need_info', 'escalated'];

const WORK_STATUSES: PanneStatus[] = ['diagnosis', 'in_repair', 'waiting_parts', 'testing', 'need_info', 'escalated', 'resolved', 'cancelled'];

/** Status graph. Any active ticket can move to any working status, so a team can answer "réparé" straight away. */
export const ALLOWED_TRANSITIONS: Record<PanneStatus, PanneStatus[]> = {
  ...(Object.fromEntries(OPEN_PANNE_STATUSES.map((s) => [s, WORK_STATUSES.filter((n) => n !== s)])) as Record<PanneStatus, PanneStatus[]>),
  open: ['assigned', ...WORK_STATUSES],
  resolved: ['in_repair', 'closed'],
  closed: ['open'],
  cancelled: ['open'],
};

/** The answers a department team (maintenance, IT) can give on a ticket, with the wording shown on their buttons. */
export const RESPONSE_STATUSES: PanneStatus[] = ['in_repair', 'resolved', 'waiting_parts', 'need_info', 'escalated'];
export const RESPONSE_LABELS: Partial<Record<PanneStatus, string>> = {
  in_repair: 'En cours',
  resolved: 'Réparé',
  waiting_parts: 'Besoin de pièce / matériel',
  need_info: "Besoin d'informations",
  escalated: 'Impossible — escalader',
};

/** Whether `role` may move a ticket from `from` to `to`. Same rule on the server and in the UI. */
export function canSetStatus(role: UserRole, from: PanneStatus, to: PanneStatus): boolean {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) return false;
  if (to === 'closed') return hasPermission(role, 'panne.close');
  if (to === 'cancelled') return hasPermission(role, 'panne.cancel');
  if (hasPermission(role, 'panne.status')) return true;
  return hasPermission(role, 'panne.respond') && RESPONSE_STATUSES.includes(to);
}

/** Whether `role` (user `userId`) may see this ticket. */
export function canViewPanne(role: UserRole, userId: number, panne: { department: string; assigned_to: number | null }): boolean {
  if (hasPermission(role, 'panne.viewAll')) return true;
  const dept = ROLE_DEPARTMENT[role];
  return (dept != null && panne.department === dept) || panne.assigned_to === userId;
}
