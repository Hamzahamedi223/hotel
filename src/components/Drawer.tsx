import {
  IconLayoutDashboard,
  IconClipboardList,
  IconBuilding,
  IconWrench,
  IconCalendar,
  IconBox,
  IconTruck,
  IconFileText,
  IconShield,
  IconUsers,
  IconSettings,
  IconX,
} from './icons';
import { hasPermission } from '../../shared/types';
import { useSimpleMode } from '../lib/mode';
import type { UserRole } from '../../shared/types';

export type View =
  | 'dashboard'
  | 'pannes'
  | 'hotel'
  | 'equipment'
  | 'maintenance'
  | 'inventory'
  | 'contractors'
  | 'reports'
  | 'audit'
  | 'users'
  | 'settings';

type Perm = Parameters<typeof hasPermission>[1];

/** Pages only shown in "Mode complet". */
export const ADVANCED_VIEWS: View[] = ['equipment', 'maintenance', 'inventory', 'contractors', 'reports', 'audit'];

const GROUPS: { title: string; items: { key: View; label: string; icon: (p: any) => JSX.Element; perm?: Perm }[] }[] = [
  {
    title: 'Exploitation',
    items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: IconLayoutDashboard },
      { key: 'pannes', label: 'Livre de panne', icon: IconClipboardList },
    ],
  },
  {
    title: 'Hôtel',
    items: [
      { key: 'hotel', label: 'Bâtiments & chambres', icon: IconBuilding, perm: 'room.manage' },
      { key: 'equipment', label: 'Équipements', icon: IconWrench, perm: 'equipment.manage' },
    ],
  },
  {
    title: 'Maintenance',
    items: [
      { key: 'maintenance', label: 'Maintenance préventive', icon: IconCalendar, perm: 'maintenance.manage' },
      { key: 'inventory', label: 'Stock & pièces', icon: IconBox, perm: 'inventory.manage' },
      { key: 'contractors', label: 'Prestataires', icon: IconTruck, perm: 'contractor.manage' },
    ],
  },
  {
    title: 'Rapports',
    items: [{ key: 'reports', label: 'Rapports', icon: IconFileText, perm: 'reports.view' }],
  },
  {
    title: 'Administration',
    items: [
      { key: 'audit', label: "Journal d'audit", icon: IconShield, perm: 'audit.view' },
      { key: 'users', label: 'Utilisateurs', icon: IconUsers, perm: 'user.manage' },
      { key: 'settings', label: 'Réglages', icon: IconSettings, perm: 'settings.manage' },
    ],
  },
];

export default function Drawer({
  role,
  current,
  onSelect,
  onClose,
}: {
  role: UserRole;
  current: View;
  onSelect: (v: View) => void;
  onClose: () => void;
}) {
  const simple = useSimpleMode();
  return (
    <div className="fixed inset-0 z-40 flex">
      <button aria-label="Fermer" onClick={onClose} className="flex-1 bg-overlay/45 backdrop-blur-[1px]" />
      <div className="w-[320px] max-w-[85vw] bg-surface border-l border-line h-full flex flex-col shadow-float animate-[toast-in_.16s_ease-out]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Menu</h2>
          <button onClick={onClose} className="btn-ghost btn-xs !px-2">
            <IconX size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3">
          {GROUPS.map((group) => {
            const visible = group.items.filter((i) => (!i.perm || hasPermission(role, i.perm)) && !(simple && ADVANCED_VIEWS.includes(i.key)));
            if (visible.length === 0) return null;
            return (
              <div key={group.title} className="mb-4">
                <div className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{group.title}</div>
                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onSelect(item.key)}
                      className={current === item.key ? 'nav-item-active w-full' : 'nav-item w-full'}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
