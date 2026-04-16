// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista do Dashboard (protegida)
// Layout com sidebar + área principal + navegação interna por abas
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Calendar,
  Shield,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  UserCog,
  Clock,
} from 'lucide-react';
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

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type DashboardTab =
  | 'painel'
  | 'processos'
  | 'clientes'
  | 'utilizadores'
  | 'prazos'
  | 'documentos'
  | 'auditoria';

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
  { id: 'utilizadores', icon: UserCog, label: 'Utilizadores', roles: ['ADMIN', 'ADVOGADO'] },
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
  documentos: 'Gestão de Documentos',
  auditoria: 'Trilha de Auditoria',
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('painel');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Fechar sidebar mobile ao mudar de aba ──
  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

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
        return <ComingSoonView title="Gestão de Prazos" />;
      case 'documentos':
        return <ComingSoonView title="Gestão de Documentos" />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
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
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-bold text-sm">LD</span>
              </div>
              <span className="font-bold text-lg">
                <span className="text-white">lex</span>
                <span className="text-emerald-400">Doc</span>
              </span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mx-auto">
              <span className="text-emerald-400 font-bold text-sm">LD</span>
            </div>
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
        <div className="hidden md:flex justify-end px-2 pt-2">
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                {/* Indicador activo */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-emerald-400"
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

        {/* Informações do utilizador */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-4'} pb-4`}>
          <Separator className="border-white/10 mb-4" />
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-semibold text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                onClick={logout}
                title="Terminar sessão"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
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
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm"
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabeçalho */}
        <header className="bg-background border-b px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </Button>
              <div>
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
            </div>

            {/* Mostrar nome do utilizador no header */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{userRole}</p>
              </div>
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
        <footer className="border-t px-4 sm:px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 LexDoc — Moçambique. Todos os direitos reservados.
          </p>
        </footer>
      </div>
    </div>
  );
}
