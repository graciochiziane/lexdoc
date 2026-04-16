// ═══════════════════════════════════════════════════════════════
// LEXDOC — Quadro Kanban para Processos Jurídicos
// Drag-and-drop com @dnd-kit, colunas por estado
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Briefcase,
  Loader2,
  Columns3,
  PauseCircle,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  User,
  Scale,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { processesApi, type ProcessRecord } from '@/lib/api-client';

// ─────────────────────────────────────────
// Constantes e mapeamentos
// ─────────────────────────────────────────
type KanbanStatus = 'ACTIVE' | 'SUSPENDED' | 'APPEAL' | 'CLOSED';

const COLUMNS: Array<{
  id: KanbanStatus;
  label: string;
  accent: string;
  bgGradient: string;
  icon: React.ElementType;
  emptyMessage: string;
  dotColor: string;
  leftBorder: string;
  headerGlow: string;
}> = [
  {
    id: 'ACTIVE',
    label: 'Activos',
    accent: 'from-emerald-500 to-emerald-600',
    bgGradient: 'from-emerald-50/80 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10',
    icon: Briefcase,
    emptyMessage: 'Nenhum processo activo',
    dotColor: 'bg-emerald-500',
    leftBorder: 'border-l-emerald-500',
    headerGlow: 'shadow-emerald-500/10',
  },
  {
    id: 'SUSPENDED',
    label: 'Suspensos',
    accent: 'from-amber-500 to-amber-600',
    bgGradient: 'from-amber-50/80 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10',
    icon: PauseCircle,
    emptyMessage: 'Nenhum processo suspenso',
    dotColor: 'bg-amber-500',
    leftBorder: 'border-l-amber-500',
    headerGlow: 'shadow-amber-500/10',
  },
  {
    id: 'APPEAL',
    label: 'Recurso',
    accent: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-50/80 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10',
    icon: RotateCcw,
    emptyMessage: 'Nenhum processo em recurso',
    dotColor: 'bg-purple-500',
    leftBorder: 'border-l-purple-500',
    headerGlow: 'shadow-purple-500/10',
  },
  {
    id: 'CLOSED',
    label: 'Encerrados',
    accent: 'from-gray-500 to-gray-600',
    bgGradient: 'from-gray-50/80 to-gray-100/30 dark:from-gray-900/20 dark:to-gray-800/10',
    icon: CheckCircle2,
    emptyMessage: 'Nenhum processo encerrado',
    dotColor: 'bg-gray-400 dark:bg-gray-500',
    leftBorder: 'border-l-gray-400 dark:border-l-gray-500',
    headerGlow: 'shadow-gray-500/5',
  },
];

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800',
};

const AREA_LABELS: Record<string, string> = {
  CIVIL: 'Civil',
  PENAL: 'Penal',
  COMERCIAL: 'Comercial',
  TRABALHO: 'Trabalho',
  FAMILIA: 'Família',
  FISCAL: 'Fiscal',
  ADMINISTRATIVO: 'Administrativo',
  CONSTITUCIONAL: 'Constitucional',
};

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  URGENT: 'border-l-red-500',
  HIGH: 'border-l-orange-400',
  MEDIUM: 'border-l-amber-400',
  LOW: 'border-l-gray-300 dark:border-l-gray-600',
};

// ─────────────────────────────────────────
// Stagger animations
// ─────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
};

// Drop flash animation for cards
const dropFlashVariants = {
  initial: { opacity: 0, y: -8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring', stiffness: 400, damping: 25 },
};

// ─────────────────────────────────────────
// Empty Column State
// ─────────────────────────────────────────
function EmptyColumnState({ column }: { column: typeof COLUMNS[number] }) {
  const Icon = column.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-8 text-center px-2"
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${column.accent} flex items-center justify-center mb-3 shadow-lg ${column.headerGlow}`}
      >
        <Icon className="size-7 text-white/90" />
      </motion.div>
      <p className="text-xs text-muted-foreground font-medium">{column.emptyMessage}</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Sortable Process Card
// ─────────────────────────────────────────
interface SortableCardProps {
  process: ProcessRecord;
}

function SortableCard({ process }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: process.id,
    data: {
      type: 'process',
      process,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={cardVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      whileHover={{ y: -2 }}
      className={`group relative rounded-xl bg-background border shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${PRIORITY_BORDER_COLORS[process.priority] ?? ''} ${
        isDragging
          ? 'opacity-50 shadow-xl ring-2 ring-emerald-400/40 z-50 scale-105 rotate-1'
          : ''
      }`}
    >
      <div className="p-3">
        {/* Header: drag handle + process number */}
        <div className="flex items-start gap-2 mb-2">
          <button
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {process.process_number}
            </p>
          </div>
          {process.priority === 'URGENT' && (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
            </motion.div>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-2">
          {process.title}
        </p>

        {/* Client */}
        {process.client && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <User className="size-3" />
            <span className="text-xs truncate">{process.client.full_name}</span>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={`rounded-full text-[9px] px-1.5 py-0 shadow-sm ${PRIORITY_COLORS[process.priority] ?? ''}`}
          >
            {PRIORITY_LABELS[process.priority] ?? process.priority}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full text-[9px] px-1.5 py-0 shadow-sm bg-muted/50 text-muted-foreground border-border"
          >
            {AREA_LABELS[process.area] ?? process.area}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Drag Overlay Card
// ─────────────────────────────────────────
function DragOverlayCard({ process }: { process: ProcessRecord }) {
  return (
    <div className="w-[280px] rounded-xl bg-background border border-l-4 border-l-emerald-500 shadow-2xl ring-2 ring-emerald-400/30 rotate-2 scale-105">
      <div className="p-3">
        <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
          {process.process_number}
        </p>
        <p className="text-sm font-medium text-foreground leading-snug mb-2">
          {process.title}
        </p>
        {process.client && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <User className="size-3" />
            <span className="text-xs truncate">{process.client.full_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`rounded-full text-[9px] px-1.5 py-0 shadow-sm ${PRIORITY_COLORS[process.priority] ?? ''}`}
          >
            {PRIORITY_LABELS[process.priority] ?? process.priority}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full text-[9px] px-1.5 py-0 shadow-sm bg-muted/50 text-muted-foreground border-border"
          >
            {AREA_LABELS[process.area] ?? process.area}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Column Skeleton
// ─────────────────────────────────────────
function ColumnSkeleton() {
  return (
    <div className="min-w-[280px] w-[280px] shrink-0 flex flex-col rounded-xl border bg-muted/20">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-md" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-6 rounded-full ml-auto" />
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Kanban Column
// ─────────────────────────────────────────
interface KanbanColumnProps {
  column: typeof COLUMNS[number];
  processes: ProcessRecord[];
}

function KanbanColumn({ column, processes }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useSortable({
    id: column.id,
    data: {
      type: 'column',
    },
  });

  const Icon = column.icon;

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] w-[280px] shrink-0 flex flex-col rounded-xl border transition-all duration-200 bg-gradient-to-b ${column.bgGradient} border-l-4 ${column.leftBorder} ${
        isOver
          ? `ring-2 ring-emerald-400/50 shadow-lg scale-[1.01] ${column.headerGlow}`
          : 'hover:shadow-sm'
      }`}
    >
      {/* Column Header — Glassmorphism */}
      <div className="p-3 border-b backdrop-blur-md bg-white/60 dark:bg-gray-900/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${column.accent} flex items-center justify-center shadow-sm`}>
            <Icon className="size-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
          <Badge
            variant="secondary"
            className="ml-auto h-5 min-w-[20px] flex items-center justify-center text-[10px] font-bold rounded-full bg-muted/80"
          >
            {processes.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <SortableContext
        items={processes.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-2 space-y-2 flex-1 min-h-[120px] max-h-[calc(100vh-300px)] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {processes.length === 0 ? (
              <EmptyColumnState column={column} />
            ) : (
              processes.map((process) => (
                <SortableCard key={process.id} process={process} />
              ))
            )}
          </AnimatePresence>
        </div>
      </SortableContext>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Kanban Board
// ═══════════════════════════════════════════════════════════════
export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [activeProcess, setActiveProcess] = useState<ProcessRecord | null>(null);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // Fetch all processes (high limit to get all for kanban)
  const { data, isLoading } = useQuery({
    queryKey: ['processes-kanban'],
    queryFn: () => processesApi.list('limit=200'),
    staleTime: 30 * 1000,
  });

  const allProcesses: ProcessRecord[] = data?.data ?? [];

  // Group processes by column status
  const processesByColumn = useMemo(() => {
    const grouped: Record<string, ProcessRecord[]> = {
      ACTIVE: [],
      SUSPENDED: [],
      APPEAL: [],
      CLOSED: [],
    };
    for (const process of allProcesses) {
      const status = process.status as KanbanStatus;
      if (grouped[status]) {
        grouped[status].push(process);
      } else {
        // Fallback for ARCHIVED or other statuses → put in CLOSED
        grouped.CLOSED.push(process);
      }
    }
    return grouped;
  }, [allProcesses]);

  // Mutation: update status
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      processesApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Estado do processo actualizado.');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      queryClient.invalidateQueries({ queryKey: ['processes-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: () => {
      toast.error('Erro ao actualizar estado do processo.');
    },
  });

  // Find column for a process ID
  const findColumnForProcess = (processId: string): KanbanStatus | null => {
    for (const col of COLUMNS) {
      if (processesByColumn[col.id].some((p) => p.id === processId)) {
        return col.id;
      }
    }
    return null;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const process = allProcesses.find((p) => p.id === active.id);
    if (process) {
      setActiveProcess(process);
    }
  };

  // Handle drag over — for reordering within columns
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which columns these belong to
    const activeColumn = findColumnForProcess(activeId);
    let overColumn: KanbanStatus | null = null;

    // Check if over a column
    if (COLUMNS.some((col) => col.id === overId)) {
      overColumn = overId as KanbanStatus;
    } else {
      overColumn = findColumnForProcess(overId);
    }

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move process between columns locally (optimistic)
    const activeProcessData = allProcesses.find((p) => p.id === activeId);
    if (!activeProcessData) return;

    // We handle the actual state change on drag end
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProcess(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine target column
    let targetColumn: KanbanStatus | null = null;

    // Dropped on a column
    if (COLUMNS.some((col) => col.id === overId)) {
      targetColumn = overId as KanbanStatus;
    } else {
      // Dropped on another card — find that card's column
      targetColumn = findColumnForProcess(overId);
    }

    if (!targetColumn) return;

    // Find source column
    const sourceColumn = findColumnForProcess(activeId);
    if (!sourceColumn) return;

    // If same column, reorder (handled by SortableContext natively)
    if (sourceColumn === targetColumn) {
      // Reorder within the same column
      const sourceItems = processesByColumn[sourceColumn];
      const oldIndex = sourceItems.findIndex((p) => p.id === activeId);
      const newIndex = sourceItems.findIndex((p) => p.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Optimistic reorder (we don't persist order, just visual)
        const reordered = arrayMove(sourceItems, oldIndex, newIndex);
        // Update local state would be complex here; for now just let it be
        void reordered;
      }
      return;
    }

    // Different column — update status via API
    const process = allProcesses.find((p) => p.id === activeId);
    if (process && process.status !== targetColumn) {
      statusMutation.mutate({
        id: activeId,
        status: targetColumn,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quadro Kanban</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste processos entre colunas para alterar o estado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs rounded-full shadow-sm">
            <Scale className="size-3 mr-1 text-emerald-600 dark:text-emerald-400" />
            {allProcesses.length} processo{allProcesses.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      ) : allProcesses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/20"
          >
            <Columns3 className="size-10 text-white" />
          </motion.div>
          <p className="text-sm font-medium text-foreground">
            Nenhum processo no quadro
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Crie processos jurídicos para os visualizar neste quadro Kanban.
          </p>
        </motion.div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                processes={processesByColumn[column.id] ?? []}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={{
            duration: 200,
            easing: 'ease',
          }}>
            {activeProcess ? (
              <DragOverlayCard process={activeProcess} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Status mutation loading indicator */}
      {statusMutation.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="flex items-center gap-2 bg-background border shadow-lg rounded-full px-4 py-2">
            <Loader2 className="size-4 animate-spin text-emerald-600" />
            <span className="text-sm text-muted-foreground">A actualizar...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
