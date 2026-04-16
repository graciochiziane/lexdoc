// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel Principal (Dashboard Home)
// Estatísticas, processos recentes e prazos próximos
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
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
import { statsApi, type DashboardStats } from '@/lib/api-client';

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
  },
  {
    key: 'total_clients' as const,
    label: 'Clientes',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    border: 'border-cyan-200 dark:border-cyan-900',
  },
  {
    key: 'total_documents' as const,
    label: 'Documentos',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
  },
  {
    key: 'upcoming_deadlines' as const,
    label: 'Prazos Próximos',
    icon: Calendar,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
  },
];

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
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
  };
  const labels: Record<string, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  };
  return (
    <Badge variant="outline" className={variants[priority] ?? ''}>
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
    <Badge variant="outline" className={variants[status] ?? ''}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─────────────────────────────────────────
// Estado vazio
// ─────────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function DashboardHome() {
  const { time, date } = MaputoClock();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => statsApi.dashboard(),
    staleTime: 30 * 1000,
  });

  const stats: DashboardStats | null = statsData?.data ?? null;

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
            <Card className={`${stat.border} hover:shadow-md transition-shadow`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
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

      {/* Processos Recentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Processos Recentes</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs">
            Ver todos
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : stats?.recent_processes && stats.recent_processes.length > 0 ? (
            <div className="max-h-[calc(100vh-520px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Processo</TableHead>
                    <TableHead className="hidden sm:table-cell">Título</TableHead>
                    <TableHead className="hidden md:table-cell">Cliente</TableHead>
                    <TableHead className="hidden lg:table-cell">Prioridade</TableHead>
                    <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_processes.map((process) => (
                    <TableRow key={process.id}>
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
            />
          )}
        </CardContent>
      </Card>

      {/* Próximos Prazos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Próximos Prazos</CardTitle>
          <Badge variant="outline" className="text-xs">
            {stats?.upcoming_deadlines_list?.length ?? 0} prazos
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : stats?.upcoming_deadlines_list && stats.upcoming_deadlines_list.length > 0 ? (
            <div className="space-y-3 max-h-[calc(100vh-520px)] overflow-y-auto">
              {stats.upcoming_deadlines_list.map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                    <Calendar className="size-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deadline.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deadline.process_title}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">
                      {new Date(deadline.due_date).toLocaleDateString('pt-MZ', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'Africa/Maputo',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Sem prazos próximos"
              description="Os prazos processuais aparecerão aqui."
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
