import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useLookups } from './store/lookupsStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PannesPage from './pages/PannesPage';
import HotelPage from './pages/HotelPage';
import EquipmentPage from './pages/EquipmentPage';
import MaintenancePage from './pages/MaintenancePage';
import InventoryPage from './pages/InventoryPage';
import ContractorsPage from './pages/ContractorsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import Drawer, { type View } from './components/Drawer';
import { IconClipboardList, IconMenu, IconSun, IconMoon, IconLogOut, IconArrowLeft, IconLayoutDashboard, IconWrench } from './components/icons';
import { applyTheme, getPreferredTheme, type Theme } from './lib/theme';
import { startLiveSync, stopLiveSync, useLiveTick } from './lib/live';

const TITLES: Record<View, string> = {
  dashboard: 'Tableau de bord',
  pannes: 'Livre de panne',
  hotel: 'Bâtiments & chambres',
  equipment: 'Équipements',
  maintenance: 'Maintenance préventive',
  inventory: 'Stock & pièces',
  contractors: 'Prestataires',
  reports: 'Rapports',
  audit: "Journal d'audit",
  users: 'Utilisateurs',
  settings: 'Réglages',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshLookups = useLookups((s) => s.refresh);
  const [view, setView] = useState<View>('pannes');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  const tick = useLiveTick();
  useEffect(() => {
    if (user) refreshLookups();
    else setView('pannes');
  }, [user, refreshLookups, tick]);
  useEffect(() => {
    if (!user) return;
    startLiveSync();
    return stopLiveSync;
  }, [user]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [userMenuOpen]);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  if (!user) return <LoginPage />;

  function go(v: View) {
    setView(v);
    setDrawerOpen(false);
  }

  const isHome = view === 'pannes';

  return (
    <div className="h-[100dvh] flex flex-col bg-canvas text-ink">
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <aside className="order-last md:order-none shrink-0 bg-surface border-t md:border-t-0 md:border-r border-line flex md:flex-col items-center justify-around md:justify-start px-2 md:px-0 py-1.5 md:py-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:w-16 gap-1.5 z-30">
          <div className="hidden md:flex w-9 h-9 rounded-lg bg-brand-600 text-white items-center justify-center mb-2 select-none">
            <IconWrench size={18} />
          </div>
          <RailButton active={isHome} onClick={() => setView('pannes')} icon={IconClipboardList} label="Livre de panne" />
          <RailButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={IconLayoutDashboard} label="Tableau de bord" />
          <RailButton active={!isHome && view !== 'dashboard'} onClick={() => setDrawerOpen(true)} icon={IconMenu} label="Menu" />
          <div className="hidden md:block flex-1" />
          <RailButton onClick={toggleTheme} icon={theme === 'dark' ? IconSun : IconMoon} label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'} />
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-lg bg-surface-alt hover:bg-line-strong/40 flex items-center justify-center text-xs font-bold text-ink-soft mt-1 transition-colors"
              title={user.full_name}
            >
              {initials(user.full_name)}
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 md:mb-0 md:bottom-0 md:right-auto md:left-full md:ml-2 w-56 card p-1.5 z-50 shadow-float">
                <div className="px-2.5 py-2 border-b border-line mb-1">
                  <div className="text-sm font-semibold truncate">{user.full_name}</div>
                  <div className="text-xs text-ink-faint capitalize">{user.role}</div>
                </div>
                <button onClick={logout} className="nav-item w-full !text-red-600 dark:!text-red-400 hover:!bg-red-500/10">
                  <IconLogOut size={16} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {!isHome && (
            <div className="h-14 shrink-0 border-b border-line bg-surface flex items-center gap-3 px-3 md:px-5">
              <button onClick={() => setView('pannes')} className="btn-ghost btn-sm !px-2.5">
                <IconArrowLeft size={16} />
                <span className="hidden sm:inline">Livre de panne</span>
              </button>
              <div className="w-px h-5 bg-line" />
              <h1 className="text-sm font-bold tracking-tight truncate">{TITLES[view]}</h1>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {view === 'pannes' && <PannesPage onOpenMenu={() => setDrawerOpen(true)} onNavigate={go} />}
            {view === 'dashboard' && <DashboardPage onNavigate={go} />}
            {view === 'hotel' && <HotelPage />}
            {view === 'equipment' && <EquipmentPage />}
            {view === 'maintenance' && <MaintenancePage />}
            {view === 'inventory' && <InventoryPage />}
            {view === 'contractors' && <ContractorsPage />}
            {view === 'reports' && <ReportsPage />}
            {view === 'users' && <UsersPage />}
            {view === 'audit' && <AuditLogPage />}
            {view === 'settings' && <SettingsPage />}
          </div>
        </main>

        {drawerOpen && <Drawer role={user.role} current={view} onSelect={go} onClose={() => setDrawerOpen(false)} />}
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: (p: any) => JSX.Element;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-surface-alt hover:text-ink'
      }`}
    >
      <Icon size={19} />
    </button>
  );
}
