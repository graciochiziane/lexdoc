// ═══════════════════════════════════════════════════════════════
// LEXDOC — Timeline do Processo
// Visualização temporal de actividades, prazos e notas do processo
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { processesApi, type TimelineEntry } from '@/lib/api-client';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface ProcessTimelineProps {
  processId: string;
}

// ─────────────────────────────────────────
// Estilos por tipo de acção
// ─────────────────────────────────────────
function getEntryStyle(entry: TimelineEntry) {
  const action = entry.action;

  if (action.includes('CREATED') || action === 'DEADLINE_COMPLETED')
    return {
      icon: action === 'DEADLINE_COMPLETED' ? CalendarDays : Plus,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      border: 'border-l-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
    };

  if (action.includes('UPDATED'))
    return {
      icon: Pencil,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      border: 'border-l-amber-500',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
    };

  if (action.includes('DELETED') || action.includes('CLOSED'))
    return {
      icon: XIcon,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/40',
      border: 'border-l-red-500',
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
    };

  if (entry.type === 'note')
    return {
      icon: MessageSquare,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      border: 'border-l-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
    };

  if (entry.type === 'deadline')
    return {
      icon: CalendarDays,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/40',
      border: 'border-l-purple-500',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200',
    };

  return {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-l-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200',
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

// ─────────────────────────────────────────
// Formatação de tempo relativo
// ─────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────
// Stagger animation
// ─────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const staggerItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div className="space-y-4 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
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
      className="flex flex-col items-center justify-center py-10 text-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/60 dark:to-amber-900/30 flex items-center justify-center mb-3"
      >
        <History className="size-7 text-amber-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Sem histórico</p>
      <p className="text-xs text-muted-foreground mt-1">
        As actividades deste processo aparecerão aqui.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function ProcessTimeline({ processId }: ProcessTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['process-timeline', processId],
    queryFn: () => processesApi.timeline(processId),
    staleTime: 30 * 1000,
    enabled: !!processId,
  });

  const entries: TimelineEntry[] = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <History className="size-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold">Timeline do Processo</h3>
        <Badge variant="outline" className="text-[10px] rounded-full shadow-sm">
          {entries.length} eventos
        </Badge>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : entries.length === 0 ? (
        <EmptyTimelineState />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-1 max-h-[400px] overflow-y-auto pr-1 relative"
        >
          {/* Linha vertical */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {entries.map((entry) => {
            const style = getEntryStyle(entry);
            const Icon = style.icon;

            return (
              <motion.div
                key={entry.id}
                variants={staggerItem}
                className={`flex items-start gap-3 p-2.5 rounded-lg border-l-3 ${style.border} hover:bg-muted/50 transition-colors relative`}
              >
                {/* Ícone */}
                <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center shrink-0 mt-0.5 z-10 relative`}>
                  <Icon className={`size-3.5 ${style.color}`} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 rounded-full ${style.badgeColor}`}
                    >
                      {getActionLabel(entry.action)}
                    </Badge>
                    {entry.type === 'deadline' && entry.details?.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
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
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {formatRelativeTime(entry.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
