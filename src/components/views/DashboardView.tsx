// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista do Dashboard (protegida)
// Layout com sidebar + área principal + navegação interna por abas
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useSyncExternalStore, useEffect } from 'react';
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
  Keyboard,
  Columns3,
  CheckSquare,
  Bell,
  BookOpen,
  FileCode2,
  Settings2,
  Bot,
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
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { ProfileDialog } from '@/components/dashboard/ProfileDialog';
import { FirmSettingsDialog } from '@/components/dashboard/FirmSettingsDialog';
import { InvitationsView } from '@/components/dashboard/InvitationsView';
import { ReportsView } from '@/components/dashboard/ReportsView';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { QuickActionsFAB } from '@/components/dashboard/QuickActionsFAB';
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide';
import { KeyboardShortcutsDialog } from '@/components/dashboard/KeyboardShortcutsDialog';
import { TaskManager } from '@/components/dashboard/TaskManager';
import { NotificationsCenter } from '@/components/dashboard/NotificationsCenter';
import { KnowledgeView } from '@/components/dashboard/KnowledgeView';
import { AIChatPanel } from '@/components/dashboard/AIChatPanel';
import { AIHubView } from '@/components/dashboard/AIHubView';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { TemplatesView } from '@/components/dashboard/TemplatesView';
import { WidgetSettings } from '@/components/dashboard/WidgetSettings';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type DashboardTab =
  | 'painel'
  | 'ia'
  | 'tarefas'
  | 'processos'
  | 'modelos'
  | 'quadro'
  | 'documentos'
  | 'clientes'
  | 'base-conhecimento'
  | 'prazos'
  | 'calendario'
  | 'utilizadores'
  | 'auditoria'
  | 'convites'
  | 'relatorios'
  | 'notificacoes';

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
  { id: 'ia', icon: Bot, label: 'Centro de IA' },
  { id: 'tarefas', icon: CheckSquare, label: 'Tarefas' },
  { id: 'processos', icon: Briefcase, label: 'Processos' },
  { id: 'modelos', icon: FileCode2, label: 'Modelos de Processo', roles: ['ADMIN', 'ADVOGADO'] },
  { id: 'quadro', icon: Columns3, label: 'Quadro Kanban' },
  { id: 'documentos', icon: FileText, label: 'Documentos' },
  { id: 'clientes', icon: Users, label: 'Clientes' },
  { id: 'base-conhecimento', icon: BookOpen, label: 'Base de Conhecimento' },
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
  ia: 'Centro de Inteligência Artificial',
  tarefas: 'Minhas Tarefas',
  processos: 'Processos Jurídicos',
  modelos: 'Modelos de Processo',
  quadro: 'Quadro Kanban',
  clientes: 'Gestão de Clientes',
  utilizadores: 'Gestão de Utilizadores',
  prazos: 'Gestão de Prazos',
  calendario: 'Calendário de Prazos',
  documentos: 'Gestão de Documentos',
  'base-conhecimento': 'Base de Conhecimento',
  auditoria: 'Trilha de Auditoria',
  convites: 'Gestão de Convites',
  relatorios: 'Relatórios e Análises',
  notificacoes: 'Centro de Notificações',
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

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  ADVOGADO: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  SECRETARIO: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  CLIENT: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
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
// Relógio do rodapé (Maputo)
// ─────────────────────────────────────────
function FooterClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function update() {
      setTime(
        new Date().toLocaleTimeString('pt-MZ', {
          timeZone: 'Africa/Maputo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono [font-variant-numeric:tabular-nums]">
      <Clock className="size-3 text-emerald-500" />
      {time} <span className="text-muted-foreground/60">CAT</span>
    </span>
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [widgetSettingsOpen, setWidgetSettingsOpen] = useState(false);

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

  // ── Navigate to notificacoes tab ──
  const navigateToNotificacoes = useCallback(() => {
    handleTabChange('notificacoes');
  }, [handleTabChange]);

  // ── Keyboard shortcuts hook ──
  useKeyboardShortcuts({
    onOpenShortcutsDialog: () => setShortcutsOpen(true),
    onTabChange: handleTabChange,
  });

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
      case 'ia':
        return <AIHubView />;
      case 'tarefas':
        return <TaskManager />;
      case 'processos':
        return <ProcessesView />;
      case 'modelos':
        return <TemplatesView />;
      case 'quadro':
        return <KanbanBoard />;
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
      case 'base-conhecimento':
        return <KnowledgeView />;
      case 'convites':
        return <InvitationsView />;
      case 'relatorios':
        return <ReportsView />;
      case 'notificacoes':
        return <NotificationsCenter />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Animated emerald gradient accent line at top */ }
      <div className="fixed top-0 left-0 right-0 h-[2px] top-accent-line-animated z-[60]" />

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

      {/* Sidebar — always fixed, with a spacer div for desktop layout */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 shrink-0
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          bg-[#0f0f1e] text-white
          flex flex-col
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : 'md:translate-x-0 -translate-x-full'}
          mt-[2px]
          sidebar-gradient-line
        `}
        aria-hidden={!sidebarOpen ? true : undefined}
      >
        {/* Sidebar pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />

        {/* Logo */}
        <div className="relative flex items-center justify-between p-4 border-b border-white/10 group">
          {!sidebarCollapsed ? (
            <button
              onClick={() => setFirmSettingsOpen(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-all duration-200 cursor-pointer hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              title="Configurações do Escritório"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-sm">LD</span>
              </div>
              <span className="font-bold text-lg">
                <span className="text-white text-glow-emerald">lex</span>
                <span className="text-emerald-400 text-glow-emerald">Doc</span>
              </span>
            </button>
          ) : (
            <button
              onClick={() => setFirmSettingsOpen(true)}
              className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mx-auto hover:opacity-80 transition-all duration-200 cursor-pointer hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
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
        <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-fade-overlay">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-lg text-sm font-medium
                  transition-all duration-200 cubic-bezier(0.4, 0, 0.2, 1) relative nav-item-hover
                  ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                {/* Indicador activo com glow */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                {/* Notification dot on Auditoria */}
                {item.id === 'auditoria' && (
                  <span className={`absolute ${sidebarCollapsed ? 'top-1 right-1' : 'top-1.5 right-1.5'} w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]`} />
                )}
                {/* Home indicator dot on Painel */}
                {item.id === 'painel' && (
                  <span className={`absolute ${sidebarCollapsed ? 'top-1 right-1' : 'top-1.5 right-1.5'} w-2 h-2 rounded-full bg-emerald-400/50`} />
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

        {/* Informações do utilizador — gradient background */}
        <div className={`relative ${sidebarCollapsed ? 'px-2' : 'px-4'} pb-4`}>
          <Separator className="border-white/10 mb-4" />
          {/* Subtle gradient background for user section */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-emerald-900/10 via-emerald-900/5 to-transparent pointer-events-none" />
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
                className="flex items-center gap-3 mb-3 w-full text-left hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer relative"
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
                    variant="outline"
                    className={`text-[10px] mt-0.5 ${ROLE_BADGE_COLORS[user.role] ?? ROLE_BADGE_COLORS.CLIENT}`}
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

      {/* Desktop spacer — simulates sidebar width in flex flow on md+ */}
      <div
        className={`hidden md:block shrink-0 mt-[2px] transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      />

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 w-full mt-[2px]">
        {/* Cabeçalho */}
        <header className="backdrop-blur-md bg-background/80 border-b px-3 sm:px-6 py-3 sm:py-4 shadow-sm relative sticky top-[2px] z-30">
          {/* Gradient shadow at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/50 dark:via-emerald-800/30 to-transparent" />
          <div className="flex items-center justify-between gap-3">
            {/* Left: menu + title + search */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden active:scale-[0.95] shrink-0 hover:bg-emerald-500/10"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {TAB_LABELS[activeTab]}
                </h1>
                {/* Breadcrumb */}
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  LexDoc
                  {activeTab !== 'painel' && (
                    <>
                      <ChevronRight className="inline size-2.5 sm:size-3 mx-0.5 sm:mx-1 text-muted-foreground/50" />
                      <span className="text-muted-foreground/80">{TAB_LABELS[activeTab]}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Right: notifications, theme, profile */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {/* Search — compact icon on mobile, full bar on md+ */}
              <div className="md:hidden">
                <SearchBar onSelect={handleSearchSelect} compact />
              </div>
              <div className="hidden md:block">
                <SearchBar onSelect={handleSearchSelect} />
              </div>

              {/* Notification bell — navigates to full notifications center */}
              <NotificationBell onClick={navigateToNotificacoes} />

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
                    className="active:scale-[0.95] hover:bg-amber-500/10"
                  >
                    {theme === 'dark' ? (
                      <Sun className="size-4 text-amber-500" />
                    ) : (
                      <Moon className="size-4" />
                    )}
                  </Button>
                </motion.div>
              )}

              {/* Keyboard shortcuts button — desktop only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                title="Atalhos de teclado (?)"
                className="hidden md:inline-flex active:scale-[0.95] hover:bg-emerald-500/10"
              >
                <Keyboard className="size-4" />
              </Button>

              {/* Widget settings button — desktop only, only on painel tab */}
              {activeTab === 'painel' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setWidgetSettingsOpen(true)}
                  title="Personalizar Painel"
                  className="hidden md:inline-flex active:scale-[0.95] hover:bg-violet-500/10"
                >
                  <Settings2 className="size-4" />
                </Button>
              )}

              {/* User avatar — icon on mobile, full on sm+ */}
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-1 sm:px-2 hover:bg-accent rounded-lg"
                onClick={() => setProfileOpen(true)}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium leading-tight">{user.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{userRole}</p>
                </div>
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 min-h-0 overflow-hidden p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={activeTab === 'ia' ? 'h-full flex flex-col' : ''}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Rodapé */}
        <footer className="relative border-t bg-gradient-to-t from-muted/50 to-transparent px-3 sm:px-6 py-2 sm:py-3 mt-auto">
          {/* Emerald gradient line at top of footer */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
            <p className="text-[10px] sm:text-xs">
              © 2026 <span className="font-semibold text-foreground/80">LexDoc</span> — Moçambique
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              <FooterClock />
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px]">
                Feito com <span className="text-red-500" aria-label="amor">❤️</span> em Moçambique
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                v1.0.0
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[10px]">Online</span>
              </span>
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

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Widget Settings Dialog */}
      <WidgetSettings open={widgetSettingsOpen} onOpenChange={setWidgetSettingsOpen} />

      {/* Onboarding Guide — shown on first login */}
      <OnboardingGuide />

      {/* AI Chat Panel — LexAssistent */}
      <AIChatPanel />
    </div>
  );
}
