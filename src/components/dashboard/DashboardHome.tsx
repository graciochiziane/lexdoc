// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel Principal (Dashboard Home)
// Estatísticas, gráficos, processos recentes e prazos próximos
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Users,
  FileText,
  Calendar,
  Shield,
  ArrowRight,
  Clock,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  ListTodo,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { statsApi, processesApi, type DashboardStats, type ProcessRecord, profileApi } from '@/lib/api-client';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { differenceInDays } from 'date-fns';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Ícones e cores das estatísticas
// ─────────────────────────────────────────
const STAT_CARDS = [
  {
    key: 'total_processes' as const,
    label: 'Total de Processos',
    icon: Briefcase,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900',
    gradient: 'from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-background',
  },
  {
    key: 'total_clients' as const,
    label: 'Clientes',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    border: 'border-cyan-200 dark:border-cyan-900',
    gradient: 'from-cyan-50/80 to-white dark:from-cyan-950/30 dark:to-background',
  },
  {
    key: 'total_documents' as const,
    label: 'Documentos',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    gradient: 'from-amber-50/80 to-white dark:from-amber-950/30 dark:to-background',
  },
  {
    key: 'upcoming_deadlines' as const,
    label: 'Prazos Próximos',
    icon: Calendar,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    gradient: 'from-red-50/80 to-white dark:from-red-950/30 dark:to-background',
  },
];

// ─────────────────────────────────────────
// Chart configs
// ─────────────────────────────────────────
const statusChartConfig: ChartConfig = {
  active: { label: 'Activo', color: 'hsl(142, 76%, 36%)' },
  suspended: { label: 'Suspenso', color: 'hsl(38, 92%, 50%)' },
  closed: { label: 'Encerrado', color: 'hsl(215, 14%, 34%)' },
};

const activityChartConfig: ChartConfig = {
  processes: { label: 'Processos', color: 'hsl(142, 76%, 36%)' },
  documents: { label: 'Documentos', color: 'hsl(38, 92%, 50%)' },
};

const priorityChartConfig: ChartConfig = {
  urgent: { label: 'Urgente', color: 'hsl(0, 72%, 51%)' },
  high: { label: 'Alta', color: 'hsl(25, 95%, 53%)' },
  medium: { label: 'Média', color: 'hsl(38, 92%, 50%)' },
  low: { label: 'Baixa', color: 'hsl(215, 14%, 34%)' },
};

// ─────────────────────────────────────────
// Componente de relógio (Maputo)
// ─────────────────────────────────────────
function MaputoClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-MZ', {
          timeZone: 'Africa/Maputo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
      setDate(
        now.toLocaleDateString('pt-MZ', {
          timeZone: 'Africa/Maputo',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { time, date };
}

// ─────────────────────────────────────────
// Shimmer Stat Card (loading state)
// ─────────────────────────────────────────
function ShimmerStatCard() {
  return (
    <div className="rounded-xl border-l-4 border-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between pb-2">
          <div className="shimmer-loading h-4 w-24 rounded" />
          <div className="shimmer-loading w-8 h-8 rounded-lg" />
        </div>
        <div className="shimmer-loading h-8 w-16 rounded mb-2" />
        <div className="shimmer-loading h-3 w-32 rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Contador animado
// ─────────────────────────────────────────
function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 800;
    const steps = 30;
    const increment = (target - count) / steps;
    let current = count;
    const timer = setInterval(() => {
      current += increment;
      if (increment > 0 && current >= target) {
        setCount(target);
        clearInterval(timer);
      } else if (increment < 0 && current <= target) {
        setCount(target);
        clearInterval(timer);
      } else if (increment === 0) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return <span>{count}</span>;
}

// ─────────────────────────────────────────
// Badge de prioridade
// ─────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200',
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 animate-pulse',
  };
  const labels: Record<string, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  };
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] shadow-sm ${variants[priority] ?? ''}`}>
      {labels[priority] ?? priority}
    </Badge>
  );
}

// ─────────────────────────────────────────
// Badge de estado do processo
// ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
    SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
    CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
    ARCHIVED: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspenso',
    CLOSED: 'Encerrado',
    ARCHIVED: 'Arquivado',
  };
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] shadow-sm ${variants[status] ?? ''}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─────────────────────────────────────────
// Estado vazio (animado)
// ─────────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-4"
      >
        <Icon className="size-10 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 shadow-md active:scale-[0.98]"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Skeleton de carregamento de gráficos
// ─────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <div className="space-y-3 w-full">
        <Skeleton className="h-4 w-24 mx-auto" />
        <Skeleton className="h-[160px] w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function DashboardHome() {
  const { time, date } = MaputoClock();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
    staleTime: 30 * 1000,
  });

  const stats: DashboardStats | null = statsData?.data ?? null;

  // Query for all processes to compute chart data
  const { data: allProcessesData, isLoading: processesLoading } = useQuery({
    queryKey: ['processes', 'chart-data'],
    queryFn: () => processesApi.list('limit=1000'),
    staleTime: 60 * 1000,
  });
  const allProcesses: ProcessRecord[] = allProcessesData?.data ?? [];

  // ── Chart data: Status distribution ──
  const statusData = useMemo(() => {
    const counts = { active: 0, suspended: 0, closed: 0 };
    for (const p of allProcesses) {
      if (p.status === 'ACTIVE') counts.active++;
      else if (p.status === 'SUSPENDED') counts.suspended++;
      else if (p.status === 'CLOSED') counts.closed++;
    }
    return [
      { name: 'active', value: counts.active, fill: 'var(--color-active)' },
      { name: 'suspended', value: counts.suspended, fill: 'var(--color-suspended)' },
      { name: 'closed', value: counts.closed, fill: 'var(--color-closed)' },
    ].filter((d) => d.value > 0);
  }, [allProcesses]);

  // ── Chart data: Priority distribution ──
  const priorityData = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const p of allProcesses) {
      if (p.priority === 'URGENT') counts.urgent++;
      else if (p.priority === 'HIGH') counts.high++;
      else if (p.priority === 'MEDIUM') counts.medium++;
      else if (p.priority === 'LOW') counts.low++;
    }
    return [
      { name: 'Urgente', value: counts.urgent, fill: 'var(--color-urgent)' },
      { name: 'Alta', value: counts.high, fill: 'var(--color-high)' },
      { name: 'Média', value: counts.medium, fill: 'var(--color-medium)' },
      { name: 'Baixa', value: counts.low, fill: 'var(--color-low)' },
    ].filter((d) => d.value > 0);
  }, [allProcesses]);

  // ── Chart data: Monthly activity (last 6 months) ──
  const activityData = useMemo(() => {
    const months: Array<{ label: string; processes: number; documents: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = format(d, 'MMM', { locale: pt });

      let pCount = 0;
      for (const p of allProcesses) {
        const created = new Date(p.created_at);
        if (created >= mStart && created <= mEnd) pCount++;
      }

      months.push({ label, processes: pCount, documents: 0 });
    }
    return months;
  }, [allProcesses]);

  // ── Timeline data: Upcoming deadlines ──
  const deadlinesTimeline = useMemo(() => {
    const upcoming = stats?.upcoming_deadlines_list ?? [];
    return upcoming.slice(0, 5).map((d) => {
      const diff = differenceInDays(new Date(d.due_date), new Date());
      let color = 'emerald';
      if (diff < 0) color = 'red';
      else if (diff <= 3) color = 'amber';
      return {
        ...d,
        daysRemaining: diff,
        color,
      };
    });
  }, [stats]);

  // ── Welcome card data ──
  const user = useAuthStore((s) => s.user);
  const [greeting, setGreeting] = useState('Bom dia');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const { data: profileData } = useQuery({
    queryKey: ['profile', 'welcome'],
    queryFn: () => profileApi.get(),
    staleTime: 60 * 1000,
  });
  const firmName = profileData?.data?.firm?.name ?? user ? '' : '';

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) setGreeting('Bom dia');
    else if (hour >= 12 && hour < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');
  }, []);

  useEffect(() => {
    if (!stats) return;
    const activeProcesses = stats.active_processes ?? 0;
    const upcomingDeadlines = stats.upcoming_deadlines ?? 0;
    setWelcomeMessage(
      `Tem ${activeProcesses} processo${activeProcesses !== 1 ? 's' : ''} activo${activeProcesses !== 1 ? 's' : ''} e ${upcomingDeadlines} prazo${upcomingDeadlines !== 1 ? 's' : ''} próximo${upcomingDeadlines !== 1 ? 's' : ''}.`
    );
  }, [stats]);

  return (
    <div className="space-y-6 relative">
      {/* ── Floating background decorations ── */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/[0.03] dark:bg-emerald-400/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-32 w-80 h-80 rounded-full bg-cyan-500/[0.03] dark:bg-cyan-400/[0.03] blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-amber-500/[0.02] dark:bg-amber-400/[0.02] blur-3xl pointer-events-none" />
      {/* Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/20">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }} />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -right-20 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/[0.03] rounded-full blur-2xl" />
          <CardContent className="relative z-10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-emerald-100 text-sm flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  {greeting}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold">
                  {user?.full_name ?? 'Utilizador'}!
                </h2>
                <p className="text-emerald-50/90 text-sm mt-1">
                  {profileData?.data?.firm?.name && (
                    <>{profileData.data.firm.name} —{' '}</>
                  )}
                  {welcomeMessage || 'Bem-vindo ao LexDoc.'}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Zap className="size-4 text-amber-200" />
                <span className="text-xs font-medium">Painel</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats Row */}
      {!statsLoading && stats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center gap-2 bg-background border rounded-full px-4 py-2 shadow-sm">
            <ListTodo className="size-4 text-emerald-500" />
            <span className="text-sm text-muted-foreground">Hoje:</span>
            <span className="text-sm font-semibold">{stats.upcoming_deadlines} tarefas</span>
          </div>
          <div className="flex items-center gap-2 bg-background border rounded-full px-4 py-2 shadow-sm">
            <Calendar className="size-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">Esta semana:</span>
            <span className="text-sm font-semibold">{stats.upcoming_deadlines} prazos</span>
          </div>
          <div className="flex items-center gap-2 bg-background border rounded-full px-4 py-2 shadow-sm">
            <Briefcase className="size-4 text-cyan-500" />
            <span className="text-sm text-muted-foreground">Activos:</span>
            <span className="text-sm font-semibold">{stats.active_processes} processos</span>
          </div>
          <div className="flex items-center gap-2 bg-background border rounded-full px-4 py-2 shadow-sm">
            <FileText className="size-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">Documentos:</span>
            <span className="text-sm font-semibold">{stats.total_documents}</span>
          </div>
        </motion.div>
      )}

      {/* Cabeçalho com hora */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel de Controlo</h2>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Clock className="size-3.5" />
          {date} — {time}
        </p>
      </div>

      {/* Cartões de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ShimmerStatCard key={i} />)
        ) : (
          STAT_CARDS.map((stat, i) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card
                className={`border-l-4 ${stat.border} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br ${stat.gradient}`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`size-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    <AnimatedCounter target={stats?.[stat.key] ?? 0} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.key === 'upcoming_deadlines'
                      ? 'Nos próximos 30 dias'
                      : stat.key === 'active_processes'
                        ? 'Processos activos neste momento'
                        : 'Registos totais'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* ── Gráficos em grelha 2x2 + Feed de Actividade ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráficos — 2 colunas */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gráfico: Processos por Estado */}
          <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-emerald-50/20 dark:from-background dark:to-emerald-950/5 border-l-4 border-l-emerald-400 shadow-[inset_0_1px_0_rgba(0,0,0,0.04),inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Processos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {processesLoading ? (
                <ChartSkeleton />
              ) : statusData.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Sem dados de processos"
                  description="Crie processos para ver a distribuição."
                />
              ) : (
                <div className="flex items-center gap-4">
                  <ChartContainer config={statusChartConfig} className="w-[140px] h-[140px] shrink-0">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={65}
                        strokeWidth={2}
                        stroke="var(--background)"
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-2">
                    {statusData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="text-sm text-muted-foreground capitalize">
                            {statusChartConfig[entry.name as keyof typeof statusChartConfig]?.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{entry.value}</span>
                      </div>
                    ))}
                    <div className="pt-1 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Total</span>
                        <span className="text-xs font-bold">
                          {statusData.reduce((s, d) => s + d.value, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico: Actividade Mensal */}
          <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-amber-50/20 dark:from-background dark:to-amber-950/5 border-l-4 border-l-amber-400 shadow-[inset_0_1px_0_rgba(0,0,0,0.04),inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Actividade Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {processesLoading ? (
                <ChartSkeleton />
              ) : (
                <ChartContainer config={activityChartConfig} className="h-[180px] w-full">
                  <BarChart data={activityData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="processes" fill="var(--color-processes)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Gráfico: Distribuição por Prioridade */}
          <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-red-50/20 dark:from-background dark:to-red-950/5 border-l-4 border-l-red-400 shadow-[inset_0_1px_0_rgba(0,0,0,0.04),inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição por Prioridade</CardTitle>
            </CardHeader>
            <CardContent>
              {processesLoading ? (
                <ChartSkeleton />
              ) : priorityData.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Sem dados"
                  description="Crie processos para ver a distribuição."
                />
              ) : (
                <div className="space-y-3 pt-1">
                  {priorityData.map((entry) => {
                    const maxVal = Math.max(...priorityData.map((d) => d.value), 1);
                    const pct = (entry.value / maxVal) * 100;
                    return (
                      <div key={entry.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{entry.name}</span>
                          <span className="text-sm font-semibold">{entry.value}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: entry.fill }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline: Próximos Prazos */}
          <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-cyan-50/20 dark:from-background dark:to-cyan-950/5 border-l-4 border-l-cyan-400 shadow-[inset_0_1px_0_rgba(0,0,0,0.04),inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Próximos Prazos</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : deadlinesTimeline.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Sem prazos próximos"
                  description="Os prazos processuais aparecerão aqui."
                />
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {deadlinesTimeline.map((deadline) => {
                    const colorClasses =
                      deadline.color === 'red'
                        ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
                        : deadline.color === 'amber'
                          ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
                    const textClasses =
                      deadline.color === 'red'
                        ? 'text-red-600 dark:text-red-400'
                        : deadline.color === 'amber'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400';
                    const daysText =
                      deadline.daysRemaining < 0
                        ? `Expirado há ${Math.abs(deadline.daysRemaining)}d`
                        : deadline.daysRemaining === 0
                          ? 'Vence hoje!'
                          : `${deadline.daysRemaining}d restantes`;

                    return (
                      <motion.div
                        key={deadline.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border-l-4 ${colorClasses} hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{deadline.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {deadline.process_title}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-semibold ${textClasses}`}>{daysText}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(deadline.due_date), 'dd/MM', { locale: pt })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feed de Actividade — 1 coluna lateral */}
        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>

      {/* Processos Recentes */}
      <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Processos Recentes</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs active:scale-[0.98]">
            Ver todos
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : stats?.recent_processes && stats.recent_processes.length > 0 ? (
            <div className="max-h-[calc(100vh-680px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Nº Processo</TableHead>
                    <TableHead className="hidden sm:table-cell">Título</TableHead>
                    <TableHead className="hidden md:table-cell">Cliente</TableHead>
                    <TableHead className="hidden lg:table-cell">Prioridade</TableHead>
                    <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_processes.map((process, i) => (
                    <TableRow
                      key={process.id}
                      className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell className="font-medium">{process.process_number}</TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[200px] truncate">
                        {process.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {process.client?.full_name ?? '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <PriorityBadge priority={process.priority} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusBadge status={process.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="Nenhum processo registado"
              description="Crie o primeiro processo jurídico para começar."
              actionLabel="Criar Processo"
            />
          )}
        </CardContent>
      </Card>

      {/* Banner informativo com gradiente */}
      <Alert className="border-0 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 shadow-sm">
        <Shield className="size-4 text-emerald-600 dark:text-emerald-400" />
        <AlertDescription className="text-emerald-800 dark:text-emerald-300">
          <p className="font-medium">Phase 1 implementada com sucesso.</p>
          <p className="text-sm mt-1">
            A funcionalidade de documentos e IA será activada na Phase 2.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
