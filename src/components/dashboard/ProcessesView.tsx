// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Processos Jurídicos
// Listagem, criação, filtros, detalhes e diálogo melhorado
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Eye,
  Briefcase,
  Loader2,
  Filter,
  Pencil,
  Calendar,
  Clock,
  FileText,
  X,
  User,
  Building,
  Scale,
  Gavel,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { processesApi, clientsApi, deadlinesApi, exportApi, type ProcessRecord, type ClientRecord, type DeadlineRecord } from '@/lib/api-client';
import { format, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Constantes e mapeamentos
// ─────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspenso',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
};

const STATUS_ICON_COLORS: Record<string, string> = {
  ACTIVE: 'text-emerald-500',
  SUSPENDED: 'text-amber-500',
  CLOSED: 'text-gray-400',
  ARCHIVED: 'text-muted-foreground',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 animate-pulse',
};

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  URGENT: 'border-l-red-500',
  HIGH: 'border-l-orange-400',
  MEDIUM: 'border-l-amber-400',
  LOW: 'border-l-gray-300 dark:border-l-gray-600',
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

const AREA_COLORS: Record<string, string> = {
  CIVIL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  PENAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
  COMERCIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  TRABALHO: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-cyan-200',
  FAMILIA: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400 border-pink-200',
  FISCAL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200',
  ADMINISTRATIVO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
  CONSTITUCIONAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200',
};

const AREAS = Object.keys(AREA_LABELS);
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Stagger animation for list items
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Badge genérico
// ─────────────────────────────────────────
function ColoredBadge({ value, labels, colors }: { value: string; labels: Record<string, string>; colors: Record<string, string> }) {
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] shadow-sm ${colors[value] ?? ''}`}>
      {labels[value] ?? value}
    </Badge>
  );
}

// ─────────────────────────────────────────
// Kanban stat pill
// ─────────────────────────────────────────
function StatusPill({ status, count }: { status: string; count: number }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    SUSPENDED: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    CLOSED: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
    ARCHIVED: 'bg-muted border-border text-muted-foreground',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status] ?? ''}`}>
      <div className={`w-2 h-2 rounded-full ${STATUS_ICON_COLORS[status]}`} />
      <span>{STATUS_LABELS[status]}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

// ─────────────────────────────────────────
// Skeleton para tabela
// ─────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-4 space-y-0">
      <div className="flex gap-4 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24 rounded" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b last:border-0">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-40 rounded hidden md:block" />
          <Skeleton className="h-4 w-24 rounded hidden lg:block" />
          <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
          <Skeleton className="h-6 w-16 rounded-full hidden md:block" />
          <Skeleton className="h-4 w-20 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state animado
// ─────────────────────────────────────────
function EmptyProcessesState() {
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
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-4"
      >
        <Scale className="size-10 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">
        Nenhum processo encontrado
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Ajuste os filtros ou crie um novo processo jurídico.
      </p>
      <Button
        onClick={() => {
          const event = new CustomEvent('lexdoc:open-create');
          window.dispatchEvent(event);
        }}
        className="mt-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all"
        size="sm"
      >
        <Plus className="size-4 mr-1.5" />
        Criar Processo
      </Button>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Formulário vazio
// ─────────────────────────────────────────
const EMPTY_FORM = {
  process_number: '',
  title: '',
  description: '',
  client_id: '',
  area: 'CIVIL',
  priority: 'MEDIUM',
  court: '',
  judge: '',
  opposing_party: '',
};

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function ProcessesView() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Diálogo de criação ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  // ── Listen for FAB create event ──
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener('lexdoc:open-create', handler);
    return () => window.removeEventListener('lexdoc:open-create', handler);
  }, []);

  // ── Diálogo de detalhes ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProcess, setDetailProcess] = useState<ProcessRecord | null>(null);

  // ── Diálogo de encerramento ──
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeProcess, setCloseProcess] = useState<ProcessRecord | null>(null);

  // ── Query: listar processos ──
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (areaFilter !== 'all') params.set('area', areaFilter);
  if (priorityFilter !== 'all') params.set('priority', priorityFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['processes', search, statusFilter, areaFilter, priorityFilter, page],
    queryFn: () => processesApi.list(params.toString()),
    staleTime: 30 * 1000,
  });

  const processes: ProcessRecord[] = data?.data ?? [];
  const meta = data?.meta;

  // ── Status counts (from meta or local) ──
  const statusCounts = {
    ACTIVE: processes.filter(p => p.status === 'ACTIVE').length,
    SUSPENDED: processes.filter(p => p.status === 'SUSPENDED').length,
    CLOSED: processes.filter(p => p.status === 'CLOSED').length,
    ARCHIVED: processes.filter(p => p.status === 'ARCHIVED').length,
  };

  // ── Query: clientes (para select) ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => clientsApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const clientList: ClientRecord[] = clientsData?.data ?? [];

  // ── Query: prazos do processo seleccionado ──
  const { data: processDeadlinesData, isLoading: deadlinesLoading } = useQuery({
    queryKey: ['process-deadlines', detailProcess?.id],
    queryFn: () => deadlinesApi.byProcess(detailProcess!.id),
    enabled: !!detailProcess,
    staleTime: 15 * 1000,
  });
  const processDeadlines: DeadlineRecord[] = processDeadlinesData?.data ?? [];

  // ── Mutation: criar processo ──
  const createMutation = useMutation({
    mutationFn: processesApi.create,
    onSuccess: () => {
      toast.success('Processo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    },
    onError: () => {
      toast.error('Erro ao criar processo.');
    },
  });

  // ── Mutation: encerrar processo ──
  const closeMutation = useMutation({
    mutationFn: processesApi.close,
    onSuccess: () => {
      toast.success('Processo encerrado.');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setCloseOpen(false);
      setCloseProcess(null);
      setDetailOpen(false);
    },
    onError: () => {
      toast.error('Erro ao encerrar processo.');
    },
  });

  // ── Export CSV ──
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportApi.processes();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processos_lexdoc_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída!');
    } catch {
      toast.error('Erro ao exportar dados.');
    } finally {
      setExporting(false);
    }
  }, []);

  // ── Handlers ──
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleCreate = useCallback(() => {
    if (!createForm.process_number || !createForm.title || !createForm.client_id) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    createMutation.mutate(createForm);
  }, [createForm, createMutation]);

  const handleClose = useCallback(() => {
    if (!closeProcess) return;
    closeMutation.mutate(closeProcess.id);
  }, [closeProcess, closeMutation]);

  const handleDetailOpen = useCallback((process: ProcessRecord) => {
    setDetailProcess(process);
    setDetailOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Processos Jurídicos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meta?.total ?? 0} processos registados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="active:scale-[0.98] transition-all hover:border-emerald-300 dark:hover:border-emerald-700"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            <span className="hidden sm:inline ml-2">Exportar CSV</span>
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all"
          >
            <Plus className="size-4" />
            Novo Processo
          </Button>
        </div>
      </div>

      {/* Kanban-like status pills */}
      {!isLoading && processes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          <StatusPill status="ACTIVE" count={statusCounts.ACTIVE} />
          <StatusPill status="SUSPENDED" count={statusCounts.SUSPENDED} />
          <StatusPill status="CLOSED" count={statusCounts.CLOSED} />
          <StatusPill status="ARCHIVED" count={statusCounts.ARCHIVED} />
        </motion.div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Pesquisa */}
        <div className="relative flex-1 max-w-sm">
          <motion.div
            animate={search ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.15 }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar processo..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </motion.div>
        </div>

        {/* Filtro de estado */}
        <Tabs value={statusFilter} onValueChange={handleStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="ACTIVE" className="text-xs">Activos</TabsTrigger>
            <TabsTrigger value="SUSPENDED" className="text-xs">Suspensos</TabsTrigger>
            <TabsTrigger value="CLOSED" className="text-xs">Encerrados</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros de área e prioridade */}
        <div className="flex gap-2">
          <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Filter className="size-3 mr-1" />
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {AREAS.map((area) => (
                <SelectItem key={area} value={area}>
                  {AREA_LABELS[area]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : processes.length === 0 ? (
            <EmptyProcessesState />
          ) : (
            <div className="max-h-[calc(100vh-340px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead>Nº Processo</TableHead>
                    <TableHead className="hidden md:table-cell">Título</TableHead>
                    <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Área</TableHead>
                    <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Prazo</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <motion.tbody
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {processes.map((process, i) => (
                      <motion.tr
                        key={process.id}
                        variants={staggerItem}
                        className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-all duration-150 hover:shadow-sm cursor-pointer border-l-4 ${PRIORITY_BORDER_COLORS[process.priority] ?? ''} ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                        onClick={() => handleDetailOpen(process)}
                      >
                        <TableCell className="font-medium">
                          {process.process_number}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                          {process.title}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {process.client?.full_name ?? '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <ColoredBadge
                            value={process.area}
                            labels={AREA_LABELS}
                            colors={AREA_COLORS}
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <ColoredBadge
                            value={process.priority}
                            labels={PRIORITY_LABELS}
                            colors={PRIORITY_COLORS}
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <ColoredBadge
                            value={process.status}
                            labels={STATUS_LABELS}
                            colors={STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {process.closed_at
                            ? format(new Date(process.closed_at), 'dd/MM/yyyy', { locale: pt })
                            : format(new Date(process.opened_at), 'dd/MM/yyyy', { locale: pt })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 active:scale-[0.95]"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDetailOpen(process);
                              }}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            {process.status === 'ACTIVE' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.95]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCloseProcess(process);
                                  setCloseOpen(true);
                                }}
                              >
                                <Briefcase className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="active:scale-[0.98]"
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {meta.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
            className="active:scale-[0.98]"
          >
            Próxima
          </Button>
        </div>
      )}

      {/* ── Diálogo: Novo Processo ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Scale className="size-5" />
              </div>
              <div>
                <p className="text-lg">Novo Processo</p>
                <DialogDescription className="text-white/80 mt-0.5">Crie um novo processo jurídico.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="proc-number">Nº Processo *</Label>
                <Input
                  id="proc-number"
                  placeholder="123/2026"
                  value={createForm.process_number}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, process_number: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <Select
                  value={createForm.client_id}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, client_id: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientList.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proc-title">Título *</Label>
              <Input
                id="proc-title"
                placeholder="Título do processo"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proc-desc">Descrição</Label>
              <Textarea
                id="proc-desc"
                placeholder="Descrição detalhada do processo..."
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground font-medium">Detalhes do Processo</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Área Jurídica</Label>
                <Select
                  value={createForm.area}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, area: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {AREA_LABELS[area]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground font-medium">Informações do Tribunal</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="proc-court">Tribunal</Label>
                <Input
                  id="proc-court"
                  placeholder="Tribunal competente"
                  value={createForm.court}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, court: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proc-judge">Juiz</Label>
                <Input
                  id="proc-judge"
                  placeholder="Nome do juiz"
                  value={createForm.judge}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, judge: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proc-opposing">Parte Contrária</Label>
              <Input
                id="proc-opposing"
                placeholder="Nome da parte contrária"
                value={createForm.opposing_party}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, opposing_party: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="active:scale-[0.98]">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98]"
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Detalhes do Processo ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailProcess && (
            <>
              <DialogHeader>
                {/* Emerald gradient header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                      <Briefcase className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-lg text-white">{detailProcess.process_number}</DialogTitle>
                      <DialogDescription className="text-white/80 truncate">{detailProcess.title}</DialogDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{STATUS_LABELS[detailProcess.status]}</Badge>
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{PRIORITY_LABELS[detailProcess.priority]}</Badge>
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{AREA_LABELS[detailProcess.area]}</Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cliente */}
                  <div className="rounded-lg border border-l-4 border-l-cyan-500 p-3 bg-gradient-to-r from-white to-cyan-50/30 dark:from-background dark:to-cyan-950/10">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <User className="size-3" /> Cliente
                    </p>
                    <p className="text-sm font-medium">
                      {detailProcess.client?.full_name ?? '—'}
                    </p>
                    {detailProcess.client?.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detailProcess.client.email}</p>
                    )}
                  </div>

                  {/* Tribunal */}
                  <div className="rounded-lg border border-l-4 border-l-emerald-500 p-3 bg-gradient-to-r from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/10">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Building className="size-3" /> Tribunal
                    </p>
                    <p className="text-sm font-medium">
                      {detailProcess.court ?? 'Não definido'}
                    </p>
                    {detailProcess.judge && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Gavel className="size-3" /> {detailProcess.judge}
                      </p>
                    )}
                  </div>

                  {/* Parte contrária */}
                  {(detailProcess.opposing_party) && (
                    <div className="rounded-lg border border-l-4 border-l-red-400 p-3 bg-gradient-to-r from-white to-red-50/30 dark:from-background dark:to-red-950/10 sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Parte Contrária</p>
                      <p className="text-sm font-medium">{detailProcess.opposing_party}</p>
                    </div>
                  )}

                  {/* Datas */}
                  <div className="rounded-lg border border-l-4 border-l-amber-400 p-3 bg-gradient-to-r from-white to-amber-50/30 dark:from-background dark:to-amber-950/10">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="size-3" /> Aberto em
                    </p>
                    <p className="text-sm font-medium">
                      {format(new Date(detailProcess.opened_at), "dd 'de' MMMM, yyyy", { locale: pt })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-l-4 border-l-gray-400 dark:border-l-gray-600 p-3 bg-gradient-to-r from-white to-gray-50/30 dark:from-background dark:to-gray-950/10">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="size-3" /> Actualizado em
                    </p>
                    <p className="text-sm font-medium">
                      {format(new Date(detailProcess.updated_at), "dd 'de' MMMM, yyyy", { locale: pt })}
                    </p>
                  </div>
                </div>

                {/* Descrição */}
                {detailProcess.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Descrição</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border">
                        {detailProcess.description}
                      </p>
                    </div>
                  </>
                )}

                {/* Prazos do processo */}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
                      Prazos do Processo
                    </p>
                    <Badge variant="outline" className="text-[10px] rounded-full shadow-sm">
                      {processDeadlines.length} prazo{processDeadlines.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {deadlinesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : processDeadlines.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem prazos registados para este processo.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {processDeadlines.map((dl) => {
                        const diff = differenceInDays(new Date(dl.due_date), new Date());
                        const dlColor = dl.status === 'COMPLETED'
                          ? 'border-l-emerald-500'
                          : diff < 0
                            ? 'border-l-red-500'
                            : diff <= 3
                              ? 'border-l-amber-500'
                              : 'border-l-emerald-500';
                        const dlBg = dl.status === 'COMPLETED'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : diff < 0
                            ? 'bg-red-50/50 dark:bg-red-950/20'
                            : diff <= 3
                              ? 'bg-amber-50/50 dark:bg-amber-950/20'
                              : 'bg-muted/30';
                        return (
                          <div key={dl.id} className={`flex items-center gap-3 p-2.5 rounded-lg border-l-4 ${dlColor} ${dlBg}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{dl.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Calendar className="size-3" />
                                {format(new Date(dl.due_date), 'dd/MM/yyyy', { locale: pt })}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] rounded-full shadow-sm ${
                                dl.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                                  : diff < 0
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200'
                                    : diff <= 3
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                              }`}
                            >
                              {dl.status === 'COMPLETED' ? 'Concluído' : diff < 0 ? 'Expirado' : diff <= 3 ? `${diff}d` : `${diff}d`}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {detailProcess.status === 'ACTIVE' && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setCloseProcess(detailProcess);
                      setDetailOpen(false);
                      setCloseOpen(true);
                    }}
                    className="active:scale-[0.98]"
                  >
                    Encerrar Processo
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="active:scale-[0.98]">
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Confirmar Encerramento ── */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              </div>
              Encerrar Processo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja encerrar o processo{' '}
              <span className="font-semibold text-foreground">
                {closeProcess?.process_number}
              </span>{' '}
              — {closeProcess?.title}? Esta acção marcará o processo como encerrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={closeMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white active:scale-[0.98]"
            >
              {closeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
