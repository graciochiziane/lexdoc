// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista do Dashboard (protegida)
// Layout com sidebar + área principal com estatísticas
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useNavStore } from '@/stores/nav.store';

// ─────────────────────────────────────────
// Itens de navegação
// ─────────────────────────────────────────
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Painel', active: true },
  { icon: Briefcase, label: 'Processos' },
  { icon: FileText, label: 'Documentos' },
  { icon: Users, label: 'Clientes' },
  { icon: Calendar, label: 'Prazos' },
  { icon: Shield, label: 'Auditoria' },
];

// ─────────────────────────────────────────
// Cartões de estatísticas
// ─────────────────────────────────────────
const STATS = [
  { label: 'Total de Processos', value: 0, icon: Briefcase },
  { label: 'Documentos', value: 0, icon: FileText },
  { label: 'Prazos Próximos', value: 0, icon: Calendar },
  { label: 'Clientes', value: 0, icon: Users },
];

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
// Formatador de data/hora (Africa/Maputo)
// ─────────────────────────────────────────
function useMaputoTime() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      // Formatar em fuso de Maputo
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Africa/Maputo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Africa/Maputo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };

      setTime(now.toLocaleTimeString('pt-MZ', options));
      setDate(now.toLocaleDateString('pt-MZ', dateOptions));
    }

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return { time, date };
}

// ─────────────────────────────────────────
// Componente do Dashboard
// ─────────────────────────────────────────
export function DashboardView() {
  const { user, logout } = useAuth();
  const { time, date } = useMaputoTime();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const userRole = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-[#0f0f1e] text-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-sm">LD</span>
            </div>
            <span className="font-bold text-lg">
              <span className="text-white">lex</span>
              <span className="text-emerald-400">Doc</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${
                  item.active
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Informações do utilizador */}
        <div className="p-4 border-t border-white/10">
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Bem-vindo, {user.full_name}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {date} — {time}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Cartões de estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <stat.icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em breve — dados reais na Phase 2
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Actividade recente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividade recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Em breve — Actividade recente
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O histórico de acções será activado na Phase 2.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Banner informativo */}
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Shield className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-300">
              <p className="font-medium">Phase 1 implementada com sucesso.</p>
              <p className="text-sm mt-1">
                A funcionalidade de documentos e IA será activada na Phase 2.
              </p>
            </AlertDescription>
          </Alert>
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
