import {
  ROOM_STATUS_LABELS,
  EQUIPMENT_STATUS_LABELS,
  PANNE_STATUS_LABELS,
  PANNE_PRIORITY_LABELS,
} from '../../shared/types';
import type { RoomStatus, EquipmentStatus, PanneStatus, PannePriority } from '../../shared/types';

const ROOM_TONE: Record<RoomStatus, string> = {
  available: 'badge-success',
  occupied: 'badge-brand',
  maintenance: 'badge-warn',
  out_of_service: 'badge-danger',
};

const EQUIPMENT_TONE: Record<EquipmentStatus, string> = {
  operational: 'badge-success',
  needs_repair: 'badge-warn',
  out_of_service: 'badge-danger',
};

const PANNE_TONE: Record<PanneStatus, string> = {
  open: 'badge-danger',
  assigned: 'badge-brand',
  diagnosis: 'badge-brand',
  waiting_parts: 'badge-warn',
  in_repair: 'badge-warn',
  testing: 'badge-warn',
  need_info: 'badge-brand',
  escalated: 'badge-danger',
  resolved: 'badge-success',
  closed: 'badge-neutral',
  cancelled: 'badge-neutral',
};

const PRIORITY_TONE: Record<PannePriority, string> = {
  critical: 'badge-danger',
  high: 'badge-warn',
  medium: 'badge-brand',
  low: 'badge-neutral',
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return <span className={ROOM_TONE[status] ?? 'badge-neutral'}>{ROOM_STATUS_LABELS[status] ?? status}</span>;
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return <span className={EQUIPMENT_TONE[status] ?? 'badge-neutral'}>{EQUIPMENT_STATUS_LABELS[status] ?? status}</span>;
}

export function PanneStatusBadge({ status }: { status: PanneStatus }) {
  return <span className={PANNE_TONE[status] ?? 'badge-neutral'}>{PANNE_STATUS_LABELS[status] ?? status}</span>;
}

export function PannePriorityBadge({ priority }: { priority: PannePriority }) {
  return <span className={PRIORITY_TONE[priority] ?? 'badge-neutral'}>{PANNE_PRIORITY_LABELS[priority] ?? priority}</span>;
}
