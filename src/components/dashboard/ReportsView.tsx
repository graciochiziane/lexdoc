// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Relatórios
// Painel abrangente com gráficos e análises do escritório
// ═══════════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  FileText,
  Calendar,
  Clock,
  Shield,
  Printer,
  TrendingUp,
  TrendingDown,
  Lock,
  HardDrive,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { reportsApi, type ReportOverviewData } from '@/lib/api-client';

// ─────────────────────────────────────────
// Chart configs
// ─────────────────────────────────────────
const areaChartConfig: ChartConfig = {
  CIVIL: { label: 'Civil', color: 'hsl(142, 76%, 36%)' },
  CRIMINAL: { label: 'Criminal', color: 'hsl(0, 72%, 51%)' },
  LABORAL: { label: 'Laboral', color: 'hsl(38, 92%, 50%)' },
  COMERCIAL: { label: 'Comercial', color: 'hsl(217, 91%, 60%)' },
  FAMILIA: { label: 'Família', color: 'hsl(280, 65%, 60%)' },
  OUTRO: { label: 'Outro', color: 'hsl(215, 14%, 34%)' },
};

const priorityChartConfig: ChartConfig = {
  LOW: { label: 'Baixa', color: 'hsl(215, 14%, 34%)' },
  MEDIUM: { label: 'Média', color: 'hsl(38, 92%, 50%)' },
  HIGH: { label: 'Alta', color: 'hsl(25, 95%, 53%)' },
  URGENT: { label: 'Urgente', color: 'hsl(0, 72%, 51%)' },
};

const clientChartConfig: ChartConfig = {
  INDIVIDUAL: { label: 'Individual', color: 'hsl(142, 76%, 36%)' },
  EMPRESA: { label: 'Empresa', color: 'hsl(217, 91%, 60%)' },
  GOVERNO: { label: 'Governo', color: 'hsl(25, 95%, 53%)' },
  ONG: { label: 'ONG', color: 'hsl(280, 65%, 60%)' },
};

const documentChartConfig: ChartConfig = {
  DRAFT: { label: 'Rascunho', color: 'hsl(38, 92%, 50%)' },
  FINAL: { label: 'Final', color: 'hsl(142, 76%, 36%)' },
  ARCHIVED: { label: 'Arquivado', color: 'hsl(215, 14%, 34%)' },
};

const activityChartConfig: ChartConfig = {
  CREATE: { label: 'Criação', color: 'hsl(142, 76%, 36%)' },
  UPDATE: { label: 'Actualização', color: 'hsl(217, 91%, 60%)' },
  DELETE: { label: 'Eliminação', color: 'hsl(0, 72%, 51%)' },
  LOGIN_SUCCESS: { label: 'Login', color: 'hsl(38, 92%, 50%)' },
};

const AREA_LABELS: Record<string, string> = {
  CIVIL: 'Civil',
  CRIMINAL: 'Criminal',
  LABORAL: 'Laboral',
  COMERCIAL: 'Comercial',
  FAMILIA: 'Família',
  OUTRO: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const CLIENT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  EMPRESA: 'Empresa',
  GOVERNO: 'Governo',
  ONG: 'ONG',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  FINAL: 'Final',
  ARCHIVED: 'Arquivado',
};

const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Actualização',
  DELETE: 'Eliminação',
  LOGIN_SUCCESS: 'Login',
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDays(days: number): string {
  if (days < 30) return `${days} dia${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months < 12) {
    return remDays > 0 ? `${months} mês${months > 1 ? 'es' : ''} e ${remDays} dia${remDays > 1 ? 's' : ''}` : `${months} mês${months > 1 ? 'es' : ''}`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} ano${years > 1 ? 's' : ''} e ${remMonths} mês${remMonths > 1 ? 'es' : ''}`;
}

function getPlanBadgeClass(plan: string): string {
  switch (plan) {
    case 'ENTERPRISE': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200';
    case 'PROFESSIONAL': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200';
    default: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200';
  }
}

// ─────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────
function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-[200px]">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Bar Chart Component
// ─────────────────────────────────────────
function HorizontalBarChart({
  data,
  config,
  labels,
  colors,
}: {
  data: Record<string, number>;
  config: ChartConfig;
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  return (
    <div className="space-y-2.5 pt-1">
      {entries.map(([key, value]) => {
        const pct = (value / maxVal) * 100;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{labels[key] ?? key}</span>
              <span className="text-sm font-semibold">{value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: colors[key] ?? 'hsl(142, 76%, 36%)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
// Pie/Donut Chart Component
// ─────────────────────────────────────────
function DonutChart({
  data,
  config,
  labels,
}: {
  data: Record<string, number>;
  config: ChartConfig;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  const chartData = entries.map(([name, value]) => ({
    name,
    value,
    fill: `var(--color-${name.toLowerCase()})`,
  }));

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={config} className="w-[130px] h-[130px] shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={58}
            strokeWidth={2}
            stroke="var(--background)"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex-1 space-y-2">
        {entries.map(([key, value]) => {
          const cfg = config[key as keyof typeof config];
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: cfg?.color ?? '#999' }}
                />
                <span className="text-sm text-muted-foreground">{labels[key] ?? key}</span>
              </div>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Deadline Progress Bar Component
// ─────────────────────────────────────────
function DeadlineStatusBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export function ReportsView() {
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => reportsApi.overview(),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const report = responseData?.data ?? null;

  // ── Process data for charts ──
  const areaData = useMemo(() => {
    if (!report) return {} as Record<string, number>;
    return report.processes.by_area;
  }, [report]);

  const priorityData = useMemo(() => {
    if (!report) return {} as Record<string, number>;
    return report.processes.by_priority;
  }, [report]);

  const clientTypeData = useMemo(() => {
    if (!report) return {} as Record<string, number>;
    return report.clients.by_type;
  }, [report]);

  const docStatusData = useMemo(() => {
    if (!report) return {} as Record<string, number>;
    return report.documents.by_status;
  }, [report]);

  const activityTypeData = useMemo(() => {
    if (!report) return {} as Record<string, number>;
    return report.activity.recent_actions_by_type;
  }, [report]);

  // Monthly comparison
  const monthlyComparison = useMemo(() => {
    if (!report) return null;
    const { this_month, last_month } = report.processes;
    const diff = this_month - last_month;
    const pct = last_month > 0 ? Math.round((diff / last_month) * 100) : 0;
    return { this_month, last_month, diff, pct };
  }, [report]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Não foi possível carregar os dados do relatório.
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header with print button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise completa do escritório {report.firm.name}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handlePrint}
          className="gap-2 active:scale-[0.98]"
        >
          <Printer className="size-4" />
          Imprimir Relatório
        </Button>
      </div>

      {/* ── Executive Summary ── */}
      <Card className="print:shadow-none print:border print:border-gray-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-emerald-500" />
            Resumo Executivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Escritório</p>
              <p className="font-semibold text-sm truncate">{report.firm.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plano</p>
              <Badge variant="outline" className={`text-xs ${getPlanBadgeClass(report.firm.plan)}`}>
                {report.firm.plan}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Membros</p>
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" />
                {report.firm.member_count}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Idade</p>
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                {formatDays(report.firm.age_days)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Process Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area breakdown */}
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="size-4 text-emerald-500" />
              Processos por Área
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={areaData}
              config={areaChartConfig}
              labels={AREA_LABELS}
              colors={{
                CIVIL: 'hsl(142, 76%, 36%)',
                CRIMINAL: 'hsl(0, 72%, 51%)',
                LABORAL: 'hsl(38, 92%, 50%)',
                COMERCIAL: 'hsl(217, 91%, 60%)',
                FAMILIA: 'hsl(280, 65%, 60%)',
                OUTRO: 'hsl(215, 14%, 34%)',
              }}
            />
          </CardContent>
        </Card>

        {/* Priority breakdown */}
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-amber-50/30 dark:from-background dark:to-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-amber-500" />
              Processos por Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              data={priorityData}
              config={priorityChartConfig}
              labels={PRIORITY_LABELS}
              colors={{
                LOW: 'hsl(215, 14%, 34%)',
                MEDIUM: 'hsl(38, 92%, 50%)',
                HIGH: 'hsl(25, 95%, 53%)',
                URGENT: 'hsl(0, 72%, 51%)',
              }}
            />
          </CardContent>
        </Card>

        {/* Monthly comparison */}
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow lg:col-span-2 bg-gradient-to-br from-white to-cyan-50/30 dark:from-background dark:to-cyan-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-cyan-500" />
              Comparação Mensal de Processos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Este mês</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {monthlyComparison?.this_month ?? 0}
                  </p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Mês passado</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {monthlyComparison?.last_month ?? 0}
                  </p>
                </div>
              </div>
              {monthlyComparison && (
                <div className="flex items-center gap-2">
                  {monthlyComparison.diff > 0 ? (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full">
                      <TrendingUp className="size-4" />
                      <span className="text-sm font-semibold">+{monthlyComparison.pct}%</span>
                    </div>
                  ) : monthlyComparison.diff < 0 ? (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-full">
                      <TrendingDown className="size-4" />
                      <span className="text-sm font-semibold">{monthlyComparison.pct}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                      <span className="text-sm font-semibold">0%</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    vs. mês passado
                  </span>
                </div>
              )}
              <div className="hidden sm:block text-center ml-auto">
                <p className="text-xs text-muted-foreground mb-1">Média/mês</p>
                <p className="text-lg font-bold">{report.processes.avg_per_month}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Client Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-cyan-50/30 dark:from-background dark:to-cyan-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-cyan-500" />
              Clientes por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={clientTypeData}
              config={clientChartConfig}
              labels={CLIENT_LABELS}
            />
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-purple-50/30 dark:from-background dark:to-purple-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Novos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[130px]">
              <div className="text-center">
                <motion.p
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-4xl font-bold text-emerald-600 dark:text-emerald-400"
                >
                  {report.clients.new_this_month}
                </motion.p>
                <p className="text-sm text-muted-foreground mt-1">
                  novos clientes este mês
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {report.clients.total} clientes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Document Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-amber-50/30 dark:from-background dark:to-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="size-4 text-amber-500" />
              Documentos por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={docStatusData}
              config={documentChartConfig}
              labels={DOC_STATUS_LABELS}
            />
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Armazenamento e Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <HardDrive className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Armazenamento total</p>
                  <p className="text-lg font-bold">{formatBytes(report.documents.total_size_bytes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                  <Lock className="size-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Documentos confidenciais</p>
                  <p className="text-lg font-bold">{report.documents.confidential_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de documentos</p>
                  <p className="text-lg font-bold">{report.documents.total}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Deadline Analytics ── */}
      <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-red-50/30 dark:from-background dark:to-red-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-red-500" />
            Análise de Prazos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{report.deadlines.overdue}</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Expirados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{report.deadlines.upcoming_7d}</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Próximos 7 dias</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{report.deadlines.upcoming_30d}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Próximos 30 dias</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted border border-border">
              <p className="text-2xl font-bold text-muted-foreground">{report.deadlines.completed}</p>
              <p className="text-xs text-muted-foreground mt-1">Concluídos</p>
            </div>
          </div>
          <div className="space-y-3">
            <DeadlineStatusBar
              label="Expirados"
              value={report.deadlines.overdue}
              total={report.deadlines.total}
              color="bg-red-500"
            />
            <DeadlineStatusBar
              label="Próximos 7 dias"
              value={report.deadlines.upcoming_7d}
              total={report.deadlines.total}
              color="bg-amber-500"
            />
            <DeadlineStatusBar
              label="Próximos 30 dias"
              value={report.deadlines.upcoming_30d}
              total={report.deadlines.total}
              color="bg-emerald-500"
            />
            <DeadlineStatusBar
              label="Concluídos"
              value={report.deadlines.completed}
              total={report.deadlines.total}
              color="bg-gray-400 dark:bg-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Activity Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most active users */}
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-purple-50/30 dark:from-background dark:to-purple-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="size-4 text-purple-500" />
              Utilizadores Mais Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.activity.most_active_users.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Sem dados de actividade
              </div>
            ) : (
              <div className="space-y-3">
                {report.activity.most_active_users.map((user, i) => {
                  const maxActions = report.activity.most_active_users[0]?.actions_count ?? 1;
                  const pct = (user.actions_count / maxActions) * 100;
                  const medalColors = ['text-amber-500', 'text-gray-400', 'text-orange-600', 'text-muted-foreground', 'text-muted-foreground'];
                  return (
                    <motion.div
                      key={user.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <span className={`text-sm font-bold w-5 text-center ${i < 3 ? medalColors[i] : ''}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{user.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {user.actions_count} acções
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity type breakdown */}
        <Card className="print:shadow-none print:border print:border-gray-300 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="size-4 text-emerald-500" />
              Tipos de Actividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={activityTypeData}
              config={activityChartConfig}
              labels={ACTIVITY_LABELS}
            />
            <div className="mt-4 pt-3 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Total de registos de auditoria: {report.activity.total_audit_entries}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-gray-500 pt-4 border-t">
        <p>Relatório gerado em {new Date().toLocaleDateString('pt-MZ', { dateStyle: 'full' })} — LexDoc © 2026</p>
      </div>
    </div>
  );
}
