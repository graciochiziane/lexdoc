// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestor de Tarefas Pessoais
// Lista de tarefas com prioridades, prazos, filtros e ordenação
// entity_type='general' para tarefas pessoais do utilizador
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  CheckSquare,
  Circle,
  Trash2,
  Pin,
  PinOff,
  AlertCircle,
  Clock,
  Filter,
  SortAsc,
  Sparkles,
  ChevronDown,
  CalendarDays,
  Flag,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { notesApi, type NoteItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
type FilterTab = 'all' | 'active' | 'completed';
type SortOption = 'priority' | 'date' | 'pinned';

const PRIORITY_CONFIG: Record<string, {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  sortWeight: number;
}> = {
  urgent: {
    label: 'Urgente',
    color: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    sortWeight: 4,
  },
  high: {
    label: 'Alta',
    color: 'text-red-600 dark:text-red-400',
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    sortWeight: 3,
  },
  medium: {
    label: 'Média',
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    sortWeight: 2,
  },
  low: {
    label: 'Baixa',
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    sortWeight: 1,
  },
};

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'completed', label: 'Concluídas' },
];

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: 'priority', label: 'Prioridade' },
  { id: 'date', label: 'Data' },
  { id: 'pinned', label: 'Fixadas' },
];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const threeDays = new Date();
  threeDays.setDate(threeDays.getDate() + 3);
  threeDays.setHours(23, 59, 59, 999);
  return due >= now && due <= threeDays;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function TaskManager() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState('low');
  const [newDueDate, setNewDueDate] = useState('');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // ── Query: buscar tarefas ──
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'general'],
    queryFn: async () => {
      const res = await notesApi.list('general', null, 1, 100);
      if (res.success && res.data) return res.data;
      return [];
    },
    staleTime: 30000,
  });

  // ── Mutation: criar tarefa ──
  const createMutation = useMutation({
    mutationFn: (data: { content: string; priority: string; due_date: string | null }) =>
      notesApi.create({
        entity_type: 'general',
        content: data.content,
        priority: data.priority,
        due_date: data.due_date,
        is_pinned: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewContent('');
      setNewPriority('low');
      setNewDueDate('');
      setShowNewTask(false);
      toast.success('Tarefa criada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar tarefa.');
    },
  });

  // ── Mutation: toggle completar ──
  const toggleMutation = useMutation({
    mutationFn: (task: NoteItem) =>
      notesApi.update(task.id, { is_completed: !task.is_completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      toast.error('Erro ao actualizar tarefa.');
    },
  });

  // ── Mutation: fixar ──
  const pinMutation = useMutation({
    mutationFn: (task: NoteItem) =>
      notesApi.update(task.id, { is_pinned: !task.is_pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      toast.error('Erro ao fixar tarefa.');
    },
  });

  // ── Mutation: eliminar ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa eliminada.');
    },
    onError: () => {
      toast.error('Erro ao eliminar tarefa.');
    },
  });

  // ── Handlers ──
  const handleCreate = useCallback(() => {
    if (!newContent.trim()) return;
    createMutation.mutate({
      content: newContent.trim(),
      priority: newPriority,
      due_date: newDueDate || null,
    });
  }, [newContent, newPriority, newDueDate, createMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  }, [handleCreate]);

  // ── Contagens ──
  const activeCount = tasks.filter((t) => !t.is_completed).length;
  const completedCount = tasks.filter((t) => t.is_completed).length;

  // ── Filtrar e ordenar ──
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filtro
    if (filter === 'active') {
      filtered = filtered.filter((t) => !t.is_completed);
    } else if (filter === 'completed') {
      filtered = filtered.filter((t) => t.is_completed);
    }

    // Ordenação
    filtered.sort((a, b) => {
      // Pinned sempre no topo
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

      // Completed sempre no fundo (dentro de cada grupo)
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;

      if (sortBy === 'priority') {
        const pa = PRIORITY_CONFIG[a.priority]?.sortWeight ?? 0;
        const pb = PRIORITY_CONFIG[b.priority]?.sortWeight ?? 0;
        return pb - pa;
      } else if (sortBy === 'date') {
        // Com data primeiro (mais cedo primeiro), depois sem data
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      // 'pinned' - já ordenado por is_pinned acima
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return filtered;
  }, [tasks, filter, sortBy]);

  const currentPriorityConfig = PRIORITY_CONFIG[newPriority] ?? PRIORITY_CONFIG.low;

  return (
    <div className="space-y-6">
      {/* Cabeçalho com estatísticas */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="size-6 text-emerald-600 dark:text-emerald-400" />
            Minhas Tarefas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerir tarefas pessoais e acompanhar prazos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm">
            {activeCount} activa{activeCount !== 1 ? 's' : ''}
          </Badge>
          {completedCount > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              {completedCount} concluída{completedCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Barra de acções */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Filtros */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 active:scale-[0.97] ${
                filter === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ordenação */}
        <div className="flex items-center gap-1.5">
          <SortAsc className="size-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm bg-transparent border-0 focus:ring-0 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-foreground"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Botão nova tarefa */}
        <Button
          onClick={() => setShowNewTask((prev) => !prev)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98] transition-transform ml-auto"
        >
          <Plus className="size-4 mr-1.5" />
          Nova tarefa
        </Button>
      </div>

      {/* Formulário nova tarefa */}
      <AnimatePresence>
        {showNewTask && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="border-emerald-200 dark:border-emerald-800/50 shadow-sm">
              <CardContent className="p-4 space-y-3">
                {/* Input principal */}
                <div className="flex items-center gap-2">
                  <Circle className="size-5 text-muted-foreground shrink-0" />
                  <Input
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Adicionar tarefa..."
                    className="border-0 focus-visible:ring-0 text-base bg-transparent"
                    autoFocus
                  />
                </div>

                {/* Opções */}
                <div className="flex flex-wrap items-center gap-3 pl-7">
                  {/* Selector de prioridade */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPriorityPicker(!showPriorityPicker)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${currentPriorityConfig.bgColor} ${currentPriorityConfig.textColor}`}
                    >
                      <Flag className="size-3" />
                      {currentPriorityConfig.label}
                      <ChevronDown className="size-3" />
                    </button>
                    <AnimatePresence>
                      {showPriorityPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute left-0 top-full mt-1 w-32 bg-popover border rounded-lg shadow-lg z-10 py-1 overflow-hidden"
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                            <button
                              key={key}
                              onClick={() => {
                                setNewPriority(key);
                                setShowPriorityPicker(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-accent transition-colors ${newPriority === key ? 'bg-accent' : ''}`}
                            >
                              <div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
                              {cfg.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Data de vencimento */}
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-36 h-7 text-xs border-0 focus-visible:ring-0 bg-transparent"
                    />
                  </div>

                  {/* Acções */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowNewTask(false);
                        setNewContent('');
                        setNewPriority('low');
                        setNewDueDate('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                      onClick={handleCreate}
                      disabled={!newContent.trim() || createMutation.isPending}
                    >
                      {createMutation.isPending ? 'A criar...' : 'Criar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de tarefas */}
      <div className="space-y-2">
        {isLoading ? (
          // Skeleton loader
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4 flex items-center gap-3">
                  <Skeleton className="size-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <motion.div
              animate={{
                y: [0, -8, 0],
                rotate: [0, 3, -3, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/40 flex items-center justify-center mb-4"
            >
              {filter === 'completed' ? (
                <CheckSquare className="size-9 text-emerald-500/60" />
              ) : (
                <Sparkles className="size-9 text-emerald-500/60" />
              )}
            </motion.div>
            <h3 className="text-lg font-semibold text-muted-foreground">
              {filter === 'completed' ? 'Nenhuma tarefa concluída' : 'Sem tarefas'}
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
              {filter === 'completed'
                ? 'Conclua tarefas e elas aparecerão aqui'
                : 'Clique em "Nova tarefa" para começar a organizar o seu dia'}
            </p>
          </motion.div>
        ) : (
          // Tarefas
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => {
              const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
              const overdue = !task.is_completed && isOverdue(task.due_date);
              const dueSoon = !task.is_completed && !overdue && isDueSoon(task.due_date);

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card
                    className={`overflow-hidden transition-all duration-200 hover:shadow-sm group ${
                      task.is_pinned ? 'ring-1 ring-emerald-200 dark:ring-emerald-800/50' : ''
                    } ${overdue ? 'ring-1 ring-red-200 dark:ring-red-800/50' : ''}`}
                  >
                    <CardContent className={`p-0`}>
                      <div className={`flex items-start gap-3 p-4 border-l-[3px] ${priorityCfg.borderColor}`}>
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleMutation.mutate(task)}
                          className="mt-0.5 shrink-0 transition-transform active:scale-90"
                          disabled={toggleMutation.isPending}
                        >
                          {task.is_completed ? (
                            <div className="size-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <Circle className="size-5 text-muted-foreground/40 hover:text-emerald-500 transition-colors" />
                          )}
                        </button>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-relaxed break-words ${
                            task.is_completed
                              ? 'line-through text-muted-foreground/60'
                              : 'text-foreground'
                          }`}>
                            {task.content}
                          </p>

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {/* Prioridade badge */}
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${priorityCfg.bgColor} ${priorityCfg.textColor} border-0`}
                            >
                              <Flag className="size-2.5 mr-0.5" />
                              {priorityCfg.label}
                            </Badge>

                            {/* Data de vencimento */}
                            {task.due_date && (
                              <span className={`flex items-center gap-1 text-[11px] ${
                                overdue
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : dueSoon
                                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                                    : 'text-muted-foreground'
                              }`}>
                                {overdue ? (
                                  <AlertCircle className="size-3" />
                                ) : dueSoon ? (
                                  <Clock className="size-3" />
                                ) : (
                                  <CalendarDays className="size-3" />
                                )}
                                {overdue ? 'Vencida' : formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Acções */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => pinMutation.mutate(task)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title={task.is_pinned ? 'Desafixar' : 'Fixar'}
                            disabled={pinMutation.isPending}
                          >
                            {task.is_pinned ? (
                              <PinOff className="size-3.5 text-emerald-500" />
                            ) : (
                              <Pin className="size-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(task.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Eliminar tarefa"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
