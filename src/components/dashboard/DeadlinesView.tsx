// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Prazos Processuais
// Listagem, criação, filtros e gestão de prazos
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  CheckCircle2,
  Calendar,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deadlinesApi, processesApi, type DeadlineRecord, type ProcessRecord } from '@/lib/api-client';
import { format, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Constantes e mapeamentos
// ─────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  OVERDUE: 'Expirado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
};

function formatDueDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: pt });
}

function getDaysInfo(dateStr: string, status: string): { text: string; color: string; progress: number } {
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diff = differenceInDays(dueDate, today);
  if (status === 'COMPLETED') return { text: 'Concluído', color: 'text-emerald-600 dark:text-emerald-400', progress: 100 };
  if (diff < 0) return { text: `Expirado há ${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''}`, color: 'text-red-600 dark:text-red-400', progress: 0 };
  if (diff === 0) return { text: 'Vence hoje!', color: 'text-red-600 dark:text-red-400', progress: 10 };
  if (diff <= 3) return { text: `${diff} dia${diff !== 1 ? 's' : ''} restante${diff !== 1 ? 's' : ''}`, color: 'text-amber-600 dark:text-amber-400', progress: Math.max(10, 100 - diff * 10) };
  if (diff <= 14) return { text: `${diff} dias restantes`, color: 'text-amber-600 dark:text-amber-400', progress: Math.max(20, 100 - diff * 5) };
  return { text: `${diff} dias restantes`, color: 'text-emerald-600 dark:text-emerald-400', progress: Math.max(50, 100 - diff) };
}

function getCardAccent(dateStr: string, status: string): string {
  if (status === 'COMPLETED') return 'border-l-emerald-500';
  if (status === 'OVERDUE') return 'border-l-red-500';
  const diff = differenceInDays(new Date(dateStr), new Date());
  if (diff <= 3) return 'border-l-amber-500';
  return 'border-l-emerald-500';
}

function getProgressBarColor(dateStr: string, status: string): string {
  if (status === 'COMPLETED') return 'bg-emerald-500';
  if (status === 'OVERDUE') return 'bg-red-500';
  const diff = differenceInDays(new Date(dateStr), new Date());
  if (diff <= 3) return 'bg-amber-500';
  return 'bg-emerald-500';
}

const EMPTY_FORM = { title: '', due_date: '', description: '', process_id: '', reminder_at: '' };

// Stagger
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyDeadlinesState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-950/60 dark:to-red-900/30 flex items-center justify-center mb-4"
      >
        <Calendar className="size-10 text-red-400" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Nenhum prazo encontrado</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">Ajuste os filtros ou crie um novo prazo.</p>
      <Button
        onClick={() => {
          const event = new CustomEvent('lexdoc:open-create');
          window.dispatchEvent(event);
        }}
        className="mt-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all"
        size="sm"
      >
        <Plus className="size-4 mr-1.5" />
        Criar Prazo
      </Button>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function DeadlinesView() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 12;

  const [createOpen, setCreateOpen] = useState(false);

  // ── Listen for FAB create event ──
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener('lexdoc:open-create', handler);
    return () => window.removeEventListener('lexdoc:open-create', handler);
  }, []);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editDeadline, setEditDeadline] = useState<DeadlineRecord | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['deadlines', statusFilter, page],
    queryFn: () => deadlinesApi.list(params.toString()),
    staleTime: 30 * 1000,
  });
  const deadlines: DeadlineRecord[] = data?.data ?? [];
  const meta = data?.meta;

  const { data: processesData } = useQuery({
    queryKey: ['processes', 'all'],
    queryFn: () => processesApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const processList: ProcessRecord[] = processesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: deadlinesApi.create,
    onSuccess: () => { toast.success('Prazo criado com sucesso!'); queryClient.invalidateQueries({ queryKey: ['deadlines'] }); setCreateOpen(false); setCreateForm(EMPTY_FORM); },
    onError: () => toast.error('Erro ao criar prazo.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: updateData }: { id: string; data: { title?: string; due_date?: string; description?: string; process_id?: string; reminder_at?: string | null; status?: string } }) => deadlinesApi.update(id, updateData),
    onSuccess: () => { toast.success('Prazo actualizado com sucesso!'); queryClient.invalidateQueries({ queryKey: ['deadlines'] }); setEditOpen(false); setEditDeadline(null); },
    onError: () => toast.error('Erro ao actualizar prazo.'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => deadlinesApi.update(id, { status: 'COMPLETED' }),
    onSuccess: () => { toast.success('Prazo marcado como concluído!'); queryClient.invalidateQueries({ queryKey: ['deadlines'] }); },
    onError: () => toast.error('Erro ao actualizar prazo.'),
  });

  const handleStatusFilter = useCallback((value: string) => { setStatusFilter(value); setPage(1); }, []);
  const handleCreate = useCallback(() => {
    if (!createForm.title || !createForm.due_date || !createForm.process_id) { toast.error('Preencha os campos obrigatórios (título, data e processo).'); return; }
    createMutation.mutate({ ...createForm, reminder_at: createForm.reminder_at || undefined });
  }, [createForm, createMutation]);

  const handleEditOpen = useCallback((deadline: DeadlineRecord) => {
    setEditDeadline(deadline);
    setEditForm({ title: deadline.title, due_date: deadline.due_date ? deadline.due_date.split('T')[0] : '', description: deadline.description ?? '', process_id: deadline.process_id, reminder_at: deadline.reminder_at ? deadline.reminder_at.split('T')[0] : '' });
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editDeadline) return;
    if (!editForm.title || !editForm.due_date || !editForm.process_id) { toast.error('Preencha os campos obrigatórios.'); return; }
    updateMutation.mutate({ id: editDeadline.id, data: { ...editForm, reminder_at: editForm.reminder_at || null } });
  }, [editDeadline, editForm, updateMutation]);

  const handleComplete = useCallback((id: string) => { completeMutation.mutate(id); }, [completeMutation]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Prazos</h2>
          <p className="text-sm text-muted-foreground mt-1">{meta?.total ?? 0} prazos registados</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all">
          <Plus className="size-4" />
          Novo Prazo
        </Button>
      </div>

      {/* Filtros */}
      <Tabs value={statusFilter} onValueChange={handleStatusFilter}>
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
          <TabsTrigger value="PENDING" className="text-xs">Pendentes</TabsTrigger>
          <TabsTrigger value="COMPLETED" className="text-xs">Concluídos</TabsTrigger>
          <TabsTrigger value="OVERDUE" className="text-xs">Expirados</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : deadlines.length === 0 ? (
        <EmptyDeadlinesState />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-320px)] overflow-y-auto"
          >
            {deadlines.map((deadline) => {
              const daysInfo = getDaysInfo(deadline.due_date, deadline.status);
              const accent = getCardAccent(deadline.due_date, deadline.status);
              const isOverdue = deadline.status !== 'COMPLETED' && differenceInDays(new Date(deadline.due_date), new Date()) < 0;
              return (
                <motion.div key={deadline.id} variants={staggerItem}>
                  <Card className={`bg-gradient-to-br from-white to-muted/20 dark:from-background dark:to-card rounded-xl border border-l-4 ${accent} p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${isOverdue ? 'ring-1 ring-red-200 dark:ring-red-800/30 animate-pulse' : ''}`}>
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{deadline.title}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {deadline.status !== 'COMPLETED' && (
                            <Button variant="ghost" size="icon" className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-[0.95]" onClick={() => handleComplete(deadline.id)} title="Marcar como concluído">
                              <CheckCircle2 className="size-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-7 active:scale-[0.95]" onClick={() => handleEditOpen(deadline)} title="Editar prazo">
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-medium">{formatDueDate(deadline.due_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className={`size-3.5 shrink-0 ${daysInfo.color} ${isOverdue ? 'animate-pulse' : ''}`} />
                          <span className={`text-xs font-medium ${daysInfo.color}`}>{daysInfo.text}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${daysInfo.progress}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${getProgressBarColor(deadline.due_date, deadline.status)}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isOverdue && (
                            <AlertTriangle className="size-3 text-red-500 shrink-0 animate-pulse" />
                          )}
                          <span className="text-xs text-muted-foreground truncate">{deadline.process?.title ?? deadline.process?.process_number ?? '—'}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] rounded-full shadow-sm flex items-center gap-1 ${STATUS_COLORS[deadline.status] ?? ''}`}>
                          {STATUS_LABELS[deadline.status] ?? deadline.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="active:scale-[0.98]">Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {meta.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="active:scale-[0.98]">Próxima</Button>
            </div>
          )}
        </>
      )}

      {/* ── Diálogos ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-red-500 to-red-400 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Calendar className="size-5" />
              </div>
              <div>
                <p className="text-lg">Novo Prazo</p>
                <DialogDescription className="text-white/80 mt-0.5">Adicione um novo prazo processual.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="deadline-title">Título *</Label><Input id="deadline-title" placeholder="Ex: Prazo para contestação" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="deadline-date">Data Limite *</Label><Input id="deadline-date" type="date" value={createForm.due_date} onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))} /></div>
              <div className="grid gap-2"><Label htmlFor="deadline-reminder">Data de Lembrete</Label><Input id="deadline-reminder" type="date" value={createForm.reminder_at} onChange={(e) => setCreateForm((f) => ({ ...f, reminder_at: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Processo *</Label><Select value={createForm.process_id} onValueChange={(v) => setCreateForm((f) => ({ ...f, process_id: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar processo" /></SelectTrigger><SelectContent>{processList.map((proc) => <SelectItem key={proc.id} value={proc.id}>{proc.process_number} — {proc.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="deadline-desc">Descrição</Label><Textarea id="deadline-desc" placeholder="Observações sobre o prazo..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98]">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}Criar Prazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Pencil className="size-5" />
              </div>
              <div>
                <p className="text-lg">Editar Prazo</p>
                <DialogDescription className="text-white/80 mt-0.5">Actualize os dados do prazo.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="edit-deadline-title">Título *</Label><Input id="edit-deadline-title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="edit-deadline-date">Data Limite *</Label><Input id="edit-deadline-date" type="date" value={editForm.due_date} onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))} /></div>
              <div className="grid gap-2"><Label htmlFor="edit-deadline-reminder">Data de Lembrete</Label><Input id="edit-deadline-reminder" type="date" value={editForm.reminder_at} onChange={(e) => setEditForm((f) => ({ ...f, reminder_at: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Processo *</Label><Select value={editForm.process_id} onValueChange={(v) => setEditForm((f) => ({ ...f, process_id: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar processo" /></SelectTrigger><SelectContent>{processList.map((proc) => <SelectItem key={proc.id} value={proc.id}>{proc.process_number} — {proc.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="edit-deadline-desc">Descrição</Label><Textarea id="edit-deadline-desc" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98]">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
