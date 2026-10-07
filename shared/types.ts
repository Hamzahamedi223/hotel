export type UserRole = 'admin' | 'manager' | 'reception' | 'housekeeping' | 'technician';

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
  | 'electrical' | 'ac' | 'plumbing' | 'heating' | 'room_equipment' | 'building' | 'housekeeping' | 'other';

export type PannePriority = 'critical' | 'high' | 'medium' | 'low';

export type GuestImpact = 'none' | 'minor' | 'significant' | 'room_unusable' | 'hotel_wide';

export type PanneStatus =
  | 'open' | 'assigned' | 'diagnosis' | 'waiting_parts' | 'in_repair' | 'testing' | 'resolved' | 'closed' | 'cancelled';

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
  'panne.create': ['admin', 'manager', 'reception', 'housekeeping', 'technician'],
  'panne.assign': ['admin', 'manager'],
  'panne.manage': ['admin', 'manager', 'technician'],
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
  other: 'Autre',
};

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
  waiting_parts: 'Attente pièces',
  in_repair: 'En réparation',
  testing: 'Test',
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

/** Statuses that block a fresh ticket from being auto-created as a duplicate. */
export const OPEN_PANNE_STATUSES: PanneStatus[] = ['open', 'assigned', 'diagnosis', 'waiting_parts', 'in_repair', 'testing'];
