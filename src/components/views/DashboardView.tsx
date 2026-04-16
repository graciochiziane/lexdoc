// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista do Dashboard (protegida)
// Layout com sidebar + área principal + navegação interna por abas
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Calendar,
  CalendarDays,
  Shield,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  UserCog,
  Clock,
  Sun,
  Moon,
  Settings,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';

// ─────────────────────────────────────────
// Sub-vistas do dashboard
// ─────────────────────────────────────────
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { ProcessesView } from '@/components/dashboard/ProcessesView';
import { ClientsView } from '@/components/dashboard/ClientsView';
import { UsersView } from '@/components/dashboard/UsersView';
import { AuditView } from '@/components/dashboard/AuditView';
import { DeadlinesView } from '@/components/dashboard/DeadlinesView';
import { DocumentsView } from '@/components/dashboard/DocumentsView';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { ProfileDialog } from '@/components/dashboard/ProfileDialog';
import { FirmSettingsDialog } from '@/components/dashboard/FirmSettingsDialog';
import { InvitationsView } from '@/components/dashboard/InvitationsView';
import { ReportsView } from '@/components/dashboard/ReportsView';
import { QuickActionsFAB } from '@/components/dashboard/QuickActionsFAB';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type DashboardTab =
  | 'painel'
  | 'processos'
  | 'documentos'
  | 'clientes'
  | 'prazos'
  | 'calendario'
  | 'utilizadores'
  | 'auditoria'
  | 'convites'
  | 'relatorios';

// ─────────────────────────────────────────
// Itens de navegação
// ─────────────────────────────────────────
const NAV_ITEMS: Array<{
  id: DashboardTab;
  icon: React.ElementType;
  label: string;
  roles?: string[];
}> = [
  { id: 'painel', icon: LayoutDashboard, label: 'Painel' },
  { id: 'processos', icon: Briefcase, label: 'Processos' },
  { id: 'documentos', icon: FileText, label: 'Documentos' },
  { id: 'clientes', icon: Users, label: 'Clientes' },
  { id: 'prazos', icon: Calendar, label: 'Prazos' },
  { id: 'calendario', icon: CalendarDays, label: 'Calendário' },
  { id: 'utilizadores', icon: UserCog, label: 'Utilizadores', roles: ['ADMIN', 'ADVOGADO'] },
  { id: 'convites', icon: UserPlus, label: 'Convites', roles: ['ADMIN'] },
  { id: 'relatorios', icon: BarChart3, label: 'Relatórios', roles: ['ADMIN', 'ADVOGADO'] },
  { id: 'auditoria', icon: Shield, label: 'Auditoria', roles: ['ADMIN', 'ADVOGADO'] },
];

// ─────────────────────────────────────────
// Rótulos dos breadcrumbs
// ─────────────────────────────────────────
const TAB_LABELS: Record<DashboardTab, string> = {
  painel: 'Painel de Controlo',
  processos: 'Processos Jurídicos',
  clientes: 'Gestão de Clientes',
  utilizadores: 'Gestão de Utilizadores',
  prazos: 'Gestão de Prazos',
  calendario: 'Calendário de Prazos',
  documentos: 'Gestão de Documentos',
  auditoria: 'Trilha de Auditoria',
  convites: 'Gestão de Convites',
  relatorios: 'Relatórios e Análises',
};

// ─────────────────────────────────────────
// Tradução de papéis
// ─────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
};

// ─────────────────────────────────────────
// Componente placeholder para abas em breve
// ─────────────────────────────────────────
function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Clock className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Esta funcionalidade será disponibilizada em breve. Estamos a trabalhar para
        oferecer a melhor experiência.
      </p>
      <Badge variant="outline" className="mt-4 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
        Em breve
      </Badge>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente do Dashboard
// ─────────────────────────────────────────
export function DashboardView() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  // Hydration-safe mounted check without setState in effect
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>('painel');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [firmSettingsOpen, setFirmSettingsOpen] = useState(false);

  // ── Fechar sidebar mobile ao mudar de aba ──
  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  // ── Navigate to prazos tab ──
  const navigateToPrazos = useCallback(() => {
    handleTabChange('prazos');
  }, [handleTabChange]);

  // ── Navigate to auditoria tab ──
  const navigateToAuditoria = useCallback(() => {
    handleTabChange('auditoria');
  }, [handleTabChange]);

  // ── Handle search result selection ──
  const handleSearchSelect = useCallback((type: string, _id: string) => {
    const tabMap: Record<string, DashboardTab> = {
      processes: 'processos',
      clients: 'clientes',
      documents: 'documentos',
      deadlines: 'prazos',
    };
    const tab = tabMap[type];
    if (tab) handleTabChange(tab);
  }, [handleTabChange]);

  if (!user) return null;

  const userRole = ROLE_LABELS[user.role] ?? user.role;

  // ── Filtrar itens de navegação por papel ──
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  // ── Renderizar conteúdo da aba ──
  const renderContent = () => {
    switch (activeTab) {
      case 'painel':
        return <DashboardHome />;
      case 'processos':
        return <ProcessesView />;
      case 'clientes':
        return <ClientsView />;
      case 'utilizadores':
        return <UsersView />;
      case 'auditoria':
        return <AuditView />;
      case 'prazos':
        return <DeadlinesView />;
      case 'calendario':
        return <CalendarView onNavigateToPrazos={navigateToPrazos} />;
      case 'documentos':
        return <DocumentsView />;
      case 'convites':
        return <InvitationsView />;
      case 'relatorios':
        return <ReportsView />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Thin emerald accent line at top */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 z-[60]" />

      {/* Overlay mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          bg-[#0f0f1e] text-white
          flex flex-col
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          mt-[2px]
        `}
      >
        {/* Sidebar pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />

        {/* Logo */}
        <div className="relative flex items-center justify-between p-4 border-b border-white/10">
          {!sidebarCollapsed ? (
            <button
              onClick={() => setFirmSettingsOpen(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              title="Configurações do Escritório"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-sm">LD</span>
              </div>
              <span className="font-bold text-lg">
                <span className="text-white">lex</span>
                <span className="text-emerald-400">Doc</span>
              </span>
            </button>
          ) : (
            <button
              onClick={() => setFirmSettingsOpen(true)}
              className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mx-auto hover:opacity-80 transition-opacity cursor-pointer"
              title="Configurações do Escritório"
            >
              <span className="text-emerald-400 font-bold text-sm">LD</span>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10 shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Botão de colapsar (desktop) */}
        <div className="hidden md:flex justify-end px-2 pt-2 relative">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-white hover:bg-white/10 size-7"
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        {/* Navegação */}
        <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-lg text-sm font-medium
                  transition-all duration-150 relative
                  ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                {/* Indicador activo com glow */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <item.icon className="size-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && isActive && (
                  <ChevronRight className="size-3 ml-auto text-emerald-400/60" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Configurações (ADMIN only, at bottom before user info) */}
        {user.role === 'ADMIN' && (
          <div className={`relative ${sidebarCollapsed ? 'px-2' : 'px-3'} pb-2`}>
            <button
              onClick={() => setFirmSettingsOpen(true)}
              title={sidebarCollapsed ? 'Configurações' : undefined}
              className={`
                w-full flex items-center gap-3 rounded-lg text-sm font-medium
                transition-all duration-150
                ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
                text-gray-400 hover:bg-white/5 hover:text-white
              `}
            >
              <Settings className="size-4 shrink-0" />
              {!sidebarCollapsed && <span>Configurações</span>}
            </button>
          </div>
        )}

        {/* Informações do utilizador */}
        <div className={`relative ${sidebarCollapsed ? 'px-2' : 'px-4'} pb-4`}>
          <Separator className="border-white/10 mb-4" />
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setProfileOpen(true)}
                className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                title="Perfil"
              >
                <span className="text-emerald-400 font-semibold text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 active:scale-[0.95]"
                onClick={logout}
                title="Terminar sessão"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-3 mb-3 w-full text-left hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-semibold text-sm">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {user.full_name}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mt-0.5"
                  >
                    {userRole}
                  </Badge>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border hover:border-red-500/20 text-sm active:scale-[0.98]"
                onClick={logout}
              >
                <LogOut className="size-4 mr-2" />
                Terminar sessão
              </Button>
            </>
          )}
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 mt-[2px]">
        {/* Cabeçalho */}
        <header className="bg-background border-b px-4 sm:px-6 py-4 shadow-sm relative">
          {/* Gradient shadow at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/50 dark:via-emerald-800/30 to-transparent" />
          <div className="flex items-center justify-between gap-3">
            {/* Left: menu + title + search */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden active:scale-[0.95] shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                    {TAB_LABELS[activeTab]}
                  </h1>
                </div>
                {/* Breadcrumb */}
                <p className="text-xs text-muted-foreground mt-0.5">
                  LexDoc
                  {activeTab !== 'painel' && (
                    <>
                      <ChevronRight className="inline size-3 mx-1 text-muted-foreground/50" />
                      <span className="text-muted-foreground/80">{TAB_LABELS[activeTab]}</span>
                    </>
                  )}
                </p>
              </div>
              {/* Search bar - hidden on small mobile */}
              <div className="hidden md:block ml-4">
                <SearchBar onSelect={handleSearchSelect} />
              </div>
            </div>

            {/* Right: notifications, theme, profile */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Mobile search trigger */}
              <div className="md:hidden">
                <SearchBar onSelect={handleSearchSelect} />
              </div>

              {/* Notification bell */}
              <NotificationPanel onViewAll={navigateToAuditoria} />

              {/* Toggle modo escuro */}
              {mounted && (
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                    className="active:scale-[0.95]"
                  >
                    {theme === 'dark' ? (
                      <Sun className="size-4 text-amber-500" />
                    ) : (
                      <Moon className="size-4" />
                    )}
                  </Button>
                </motion.div>
              )}

              {/* User avatar - opens profile dialog */}
              <Button
                variant="ghost"
                className="hidden sm:flex items-center gap-2 px-2 hover:bg-accent rounded-lg"
                onClick={() => setProfileOpen(true)}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium leading-tight">{user.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{userRole}</p>
                </div>
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Rodapé */}
        <footer className="border-t bg-gradient-to-t from-muted/50 to-transparent px-4 sm:px-6 py-3 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
            <p>
              © 2026 <span className="font-semibold text-foreground/80">LexDoc</span> — Moçambique. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-3">
              <span>v1.0.0</span>
              <span className="text-muted-foreground/40">•</span>
              <span>Plataforma SaaS de Gestão Documental Jurídica</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Profile Dialog */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Firm Settings Dialog */}
      <FirmSettingsDialog open={firmSettingsOpen} onOpenChange={setFirmSettingsOpen} />

      {/* Quick Actions FAB */}
      <QuickActionsFAB />
    </div>
  );
}
