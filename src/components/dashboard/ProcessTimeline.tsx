// ═══════════════════════════════════════════════════════════════
// LEXDOC — Timeline do Processo (Enhanced)
// Visualização temporal de actividades, prazos e notas do processo
// Color-coded: audit=blue, deadline=amber, note=green
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  X as XIcon,
  Clock,
  FileText,
  CalendarDays,
  History,
  Loader2,
  MessageSquare,
  Filter,
  Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { processesApi, type TimelineEntry } from '@/lib/api-client';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface ProcessTimelineProps {
  processId: string;
}

// ─────────────────────────────────────────
// Tipos de filtro
// ─────────────────────────────────────────
type FilterType = 'all' | 'audit' | 'deadline' | 'note';

const FILTER_OPTIONS: Array<{ value: FilterType; label: string; icon: typeof Activity; color: string }> = [
  { value: 'all', label: 'Todos', icon: Activity, color: 'text-muted-foreground' },
  { value: 'audit', label: 'Auditoria', icon: FileText, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'deadline', label: 'Prazos', icon: CalendarDays, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'note', label: 'Notas', icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400' },
];

// ─────────────────────────────────────────
// Estilos por tipo de timeline
// ─────────────────────────────────────────
function getEntryStyle(entry: TimelineEntry) {
  // Type-based colors (audit=blue, deadline=amber, note=green)
  if (entry.type === 'note')
    return {
      icon: MessageSquare,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      border: 'border-l-emerald-500',
      dotColor: 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-800',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
      lineColor: 'bg-emerald-200 dark:bg-emerald-800',
    };

  if (entry.type === 'deadline')
    return {
      icon: CalendarDays,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      border: 'border-l-amber-500',
      dotColor: 'bg-amber-500 ring-amber-200 dark:ring-amber-800',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
      lineColor: 'bg-amber-200 dark:bg-amber-800',
    };

  // Default: audit
  if (entry.action.includes('CREATED') || entry.action === 'DEADLINE_COMPLETED')
    return {
      icon: entry.action === 'DEADLINE_COMPLETED' ? CalendarDays : Plus,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      border: 'border-l-blue-500',
      dotColor: 'bg-blue-500 ring-blue-200 dark:ring-blue-800',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200',
      lineColor: 'bg-blue-200 dark:bg-blue-800',
    };

  if (entry.action.includes('UPDATED'))
    return {
      icon: Pencil,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-100 dark:bg-sky-900/40',
      border: 'border-l-sky-500',
      dotColor: 'bg-sky-500 ring-sky-200 dark:ring-sky-800',
      badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border-sky-200',
      lineColor: 'bg-sky-200 dark:bg-sky-800',
    };

  if (entry.action.includes('DELETED') || entry.action.includes('CLOSED'))
    return {
      icon: XIcon,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/40',
      border: 'border-l-red-500',
      dotColor: 'bg-red-500 ring-red-200 dark:ring-red-800',
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
      lineColor: 'bg-red-200 dark:bg-red-800',
    };

  return {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-l-blue-500',
    dotColor: 'bg-blue-500 ring-blue-200 dark:ring-blue-800',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200',
    lineColor: 'bg-blue-200 dark:bg-blue-800',
  };
}

function getActionLabel(action: string): string {
  if (action.includes('CREATED')) return 'Criação';
  if (action.includes('UPDATED')) return 'Actualização';
  if (action.includes('DELETED')) return 'Eliminação';
  if (action.includes('CLOSED')) return 'Encerramento';
  if (action === 'DEADLINE_COMPLETED') return 'Prazo concluído';
  if (action === 'DEADLINE_CREATED') return 'Novo prazo';
  if (action === 'NOTE_ADDED') return 'Nota';
  return 'Actividade';
}

function getTypeLabel(type: string): string {
  if (type === 'audit') return 'Auditoria';
  if (type === 'deadline') return 'Prazo';
  if (type === 'note') return 'Nota';
  return type;
}

// ─────────────────────────────────────────
// Formatação de tempo relativo em Português
// ─────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 10) return 'agora mesmo';
  if (diffSeconds < 60) return `há ${diffSeconds} segundo${diffSeconds !== 1 ? 's' : ''}`;
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  if (diffWeeks < 5) return `há ${diffWeeks} semana${diffWeeks !== 1 ? 's' : ''}`;
  if (diffMonths < 12) return `há ${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'}`;
  return new Date(dateStr).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────
// Group entries by date
// ─────────────────────────────────────────
function groupByDate(entries: TimelineEntry[]): Array<{ date: string; entries: TimelineEntry[] }> {
  const groups: Record<string, TimelineEntry[]> = {};
  for (const entry of entries) {
    const dateKey = new Date(entry.created_at).toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
  }
  return Object.entries(groups).map(([date, items]) => ({ date, entries: items }));
}

// ─────────────────────────────────────────
// Stagger animation
// ─────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, x: -12, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};
const groupAnim = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {Array.from({ length: 3 }).map((_, groupIdx) => (
        <div key={groupIdx} className="space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyTimelineState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-emerald-50 dark:from-blue-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-4"
      >
        <History className="size-8 text-blue-500 dark:text-blue-400" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Sem histórico</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
        As actividades, prazos e notas deste processo aparecerão aqui.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function ProcessTimeline({ processId }: ProcessTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['process-timeline', processId],
    queryFn: () => processesApi.timeline(processId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!processId,
  });

  const allEntries: TimelineEntry[] = data?.data ?? [];

  // Apply filter
  const filteredEntries = useMemo(() => {
    if (filter === 'all') return allEntries;
    return allEntries.filter((e) => e.type === filter);
  }, [allEntries, filter]);

  // Group by date
  const groups = useMemo(() => groupByDate(filteredEntries), [filteredEntries]);

  // Counts per type
  const counts = useMemo(() => ({
    audit: allEntries.filter((e) => e.type === 'audit').length,
    deadline: allEntries.filter((e) => e.type === 'deadline').length,
    note: allEntries.filter((e) => e.type === 'note').length,
  }), [allEntries]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho com filtro */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold">Timeline</h3>
          <Badge variant="outline" className="text-[10px] rounded-full shadow-sm">
            {filteredEntries.length} evento{filteredEntries.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Filtros por tipo */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = filter === opt.value;
            const count = opt.value === 'all' ? allEntries.length : counts[opt.value as 'audit' | 'deadline' | 'note'];
            return (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(opt.value)}
                className={`h-7 px-2 text-[10px] gap-1 rounded-full transition-all active:scale-[0.97] ${
                  isActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-3" />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="font-medium [font-variant-numeric:tabular-nums]">{count}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : filteredEntries.length === 0 ? (
        <EmptyTimelineState />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          key={`${filter}-${dataUpdatedAt}`}
          className="max-h-[450px] overflow-y-auto pr-1 space-y-6"
        >
          {groups.map((group) => (
            <motion.div key={group.date} variants={groupAnim}>
              {/* Date group header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap px-2">
                  {group.date}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Entries in this date group */}
              <div className="relative ml-4">
                {/* Vertical timeline line */}
                <div className="absolute left-0 top-2 bottom-2 w-px bg-border z-0" />

                <motion.div variants={stagger} className="space-y-1">
                  {group.entries.map((entry, idx) => {
                    const style = getEntryStyle(entry);
                    const Icon = style.icon;
                    const isLast = idx === group.entries.length - 1;

                    return (
                      <motion.div
                        key={entry.id}
                        variants={staggerItem}
                        className={`flex items-start gap-3 p-3 rounded-xl border-l-[3px] ${style.border} hover:bg-muted/50 transition-all duration-200 relative group cursor-default ${
                          isLast ? 'mb-0' : ''
                        }`}
                      >
                        {/* Dot + icon */}
                        <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center shrink-0 mt-0.5 z-10 ring-2 ring-background transition-shadow group-hover:shadow-md`}>
                          <Icon className={`size-3.5 ${style.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${style.badgeColor}`}
                            >
                              {getActionLabel(entry.action)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[8px] px-1 py-0 rounded-full ${
                                entry.type === 'audit'
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200'
                                  : entry.type === 'deadline'
                                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200'
                              }`}
                            >
                              {getTypeLabel(entry.type)}
                            </Badge>
                            {entry.type === 'deadline' && entry.details?.due_date && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-medium">
                                <CalendarDays className="size-2.5" />
                                {new Date(entry.details.due_date as string).toLocaleDateString('pt-MZ', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground leading-snug mt-1">
                            <span className="font-medium">{entry.user_name}</span>
                            {' '}
                            <span className="text-muted-foreground">{entry.description}</span>
                          </p>
                          <p
                            className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1"
                            title={formatFullDate(entry.created_at)}
                          >
                            <Clock className="size-2.5" />
                            {formatRelativeTime(entry.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
