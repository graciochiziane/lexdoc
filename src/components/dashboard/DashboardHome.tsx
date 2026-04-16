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
} from 'lucide-react';
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
import { statsApi, processesApi, type DashboardStats, type ProcessRecord } from '@/lib/api-client';
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho com hora */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel de Controlo</h2>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {date} — {time}
        </p>
      </div>

      {/* Cartões de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat, i) => (
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
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">
                    <AnimatedCounter target={stats?.[stat.key] ?? 0} />
                  </p>
                )}
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
        ))}
      </div>

      {/* ── Gráficos em grelha 2x2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico: Processos por Estado */}
        <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-emerald-50/20 dark:from-background dark:to-emerald-950/5 border-l-4 border-l-emerald-400">
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
        <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-amber-50/20 dark:from-background dark:to-amber-950/5 border-l-4 border-l-amber-400">
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
        <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-red-50/20 dark:from-background dark:to-red-950/5 border-l-4 border-l-red-400">
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
        <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-cyan-50/20 dark:from-background dark:to-cyan-950/5 border-l-4 border-l-cyan-400">
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
    </div>
  );
}
