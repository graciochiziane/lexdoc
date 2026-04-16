// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Processos Jurídicos
// Listagem, criação, filtros, detalhes e diálogo melhorado
// Tabela avançada com DataTable, timeline e notas integradas
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  MessageSquare,
  History,
  Copy,
  Check,
  Archive,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DataTable, type DataTableProps } from '@/components/ui/data-table';
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
import { NotesPanel } from '@/components/dashboard/NotesPanel';
import { ProcessTimeline } from '@/components/dashboard/ProcessTimeline';
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
  APPEAL: 'Recurso',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
  APPEAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border-purple-200',
};

const STATUS_ICON_COLORS: Record<string, string> = {
  ACTIVE: 'text-emerald-500',
  SUSPENDED: 'text-amber-500',
  CLOSED: 'text-gray-400',
  ARCHIVED: 'text-muted-foreground',
  APPEAL: 'text-purple-500',
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
    APPEAL: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status] ?? ''}`}>
      <div className={`w-2 h-2 rounded-full ${STATUS_ICON_COLORS[status]}`} />
      <span>{STATUS_LABELS[status]}</span>
      <span className="font-bold [font-variant-numeric:tabular-nums]">{count}</span>
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
// Column definitions for DataTable
// ─────────────────────────────────────────
function useProcessColumns(
  onView: (process: ProcessRecord) => void,
  onClose: (process: ProcessRecord) => void,
): ColumnDef<ProcessRecord, unknown>[] {
  return useMemo(
    () => [
      {
        accessorKey: 'process_number',
        header: 'Nº Processo',
        size: 140,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.process_number}</span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Título',
        size: 200,
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate block">{row.original.title}</span>
        ),
      },
      {
        accessorKey: 'client',
        header: 'Cliente',
        size: 150,
        accessorFn: (row) => row.client?.full_name ?? '—',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.client?.full_name ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'area',
        header: 'Área',
        size: 110,
        cell: ({ row }) => (
          <ColoredBadge value={row.original.area} labels={AREA_LABELS} colors={AREA_COLORS} />
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Prioridade',
        size: 100,
        cell: ({ row }) => (
          <ColoredBadge value={row.original.priority} labels={PRIORITY_LABELS} colors={PRIORITY_COLORS} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        size: 100,
        cell: ({ row }) => (
          <ColoredBadge value={row.original.status} labels={STATUS_LABELS} colors={STATUS_COLORS} />
        ),
      },
      {
        accessorKey: 'opened_at',
        header: 'Data',
        size: 100,
        cell: ({ row }) => {
          const date = row.original.closed_at
            ? new Date(row.original.closed_at)
            : new Date(row.original.opened_at);
          return (
            <span className="text-muted-foreground text-sm">
              {format(date, 'dd/MM/yyyy', { locale: pt })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Acções',
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 active:scale-[0.95]"
              onClick={(e) => {
                e.stopPropagation();
                onView(row.original);
              }}
            >
              <Eye className="size-3.5" />
            </Button>
            {row.original.status === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.95]"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(row.original);
                }}
              >
                <Briefcase className="size-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [onView, onClose],
  );
}

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
  const limit = 20;

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
  const [detailTab, setDetailTab] = useState<'info' | 'notes' | 'timeline'>('info');
  const [copied, setCopied] = useState(false);

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
    APPEAL: processes.filter(p => p.status === 'APPEAL').length,
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

  // ── Column definitions ──
  const columns = useProcessColumns(
    handleDetailOpen,
    (proc) => { setCloseProcess(proc); setCloseOpen(true); },
  );

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
    setDetailTab('info');
    setDetailOpen(true);
    setCopied(false);
  }, []);

  const handleCopyNumber = useCallback(() => {
    if (!detailProcess) return;
    navigator.clipboard.writeText(detailProcess.process_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [detailProcess]);

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
          <StatusPill status="APPEAL" count={statusCounts.APPEAL} />
          <StatusPill status="CLOSED" count={statusCounts.CLOSED} />
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
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20 data-[state=active]:border-0 dark:data-[state=active]:from-emerald-600 dark:data-[state=active]:to-emerald-700">Todos</TabsTrigger>
            <TabsTrigger value="ACTIVE" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-500/20 data-[state=active]:border-0 dark:data-[state=active]:from-emerald-600 dark:data-[state=active]:to-emerald-700">Activos</TabsTrigger>
            <TabsTrigger value="SUSPENDED" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 data-[state=active]:border-0 dark:data-[state=active]:from-amber-600 dark:data-[state=active]:to-amber-700">Suspensos</TabsTrigger>
            <TabsTrigger value="CLOSED" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-500 data-[state=active]:to-gray-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-gray-500/20 data-[state=active]:border-0 dark:data-[state=active]:from-gray-600 dark:data-[state=active]:to-gray-700">Encerrados</TabsTrigger>
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

      {/* Tabela com DataTable */}
      <Card className="hover:shadow-lg transition-all duration-200 processes-table-container">
        <CardContent className="p-0">
          <div className="p-4">
            <DataTable
              columns={columns}
              data={processes}
              isLoading={isLoading}
              onRowClick={handleDetailOpen}
              enableSearch={false}
              enableColumnVisibility={true}
              enableExport={true}
              exportFilename={`processos_lexdoc_${new Date().toISOString().split('T')[0]}.csv`}
              enableRowSelection={true}
              searchPlaceholder="Pesquisar na tabela..."
              emptyMessage="Nenhum processo encontrado"
              emptyDescription="Ajuste os filtros ou crie um novo processo jurídico."
              initialPageSize={20}
              pageSizeOptions={[10, 20, 50]}
              compact={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Paginação do servidor */}
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
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600 animate-gradient rounded-t-lg" />
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
        <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto">
          {/* Gradient top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600 animate-gradient rounded-t-lg" />
          {detailProcess && (
            <>
              <DialogHeader>
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                      <Briefcase className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-lg text-white">{detailProcess.process_number}</DialogTitle>
                      <DialogDescription className="text-white/80 truncate">{detailProcess.title}</DialogDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNumber}
                      className="text-white/80 hover:text-white hover:bg-white/20 border border-white/20 rounded-lg shrink-0 active:scale-[0.95] transition-all"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span className="text-xs ml-1">{copied ? 'Copiado!' : 'Copiar'}</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{STATUS_LABELS[detailProcess.status] ?? detailProcess.status}</Badge>
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{PRIORITY_LABELS[detailProcess.priority]}</Badge>
                    <Badge className="text-[10px] border-0 bg-white/20 text-white">{AREA_LABELS[detailProcess.area]}</Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Status Timeline Stepper */}
              <div className="flex items-center justify-between mt-4 mb-2 px-1">
                {[
                  { key: 'CREATED', label: 'Criado' },
                  { key: 'ACTIVE', label: 'Em Curso' },
                  { key: 'SUSPENDED', label: 'Suspenso/Recurso' },
                  { key: 'CLOSED', label: 'Encerrado' },
                ].map((step, idx) => {
                  const statusOrder = ['CREATED', 'ACTIVE', 'SUSPENDED', 'CLOSED'];
                  const currentIdx = statusOrder.indexOf(detailProcess.status);
                  const stepIdx = statusOrder.indexOf(step.key);
                  const isCompleted = stepIdx < currentIdx;
                  const isCurrent = detailProcess.status === step.key;
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className={`flex flex-col items-center gap-1.5 ${isCurrent ? 'scale-110' : ''} transition-all duration-200`}>
                        <div className={`relative flex items-center justify-center size-7 rounded-full border-2 transition-all duration-200 ${
                          isCurrent
                            ? 'border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                            : isCompleted
                              ? 'border-emerald-400 bg-emerald-500'
                              : 'border-muted-foreground/25 bg-background'
                        }`}>
                          {isCompleted ? (
                            <Check className="size-3.5 text-white" strokeWidth={3} />
                          ) : isCurrent ? (
                            <div className="size-2.5 rounded-full bg-white" />
                          ) : (
                            <div className="size-2 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-200 ${
                          isCurrent
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isCompleted
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/40'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {idx < 3 && (
                        <div className={`w-6 sm:w-10 lg:w-16 h-0.5 mx-1 mt-[-12px] rounded-full transition-colors duration-200 ${
                          isCompleted || (isCurrent && idx === 0)
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-400'
                            : 'bg-border'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tabs de navegação */}
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as 'info' | 'notes' | 'timeline')} className="mt-1">
                <TabsList className="w-full grid grid-cols-3 h-10 relative">
                  <TabsTrigger value="info" className="text-xs data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500">
                    <FileText className="size-3 mr-1" />
                    Informações
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500">
                    <MessageSquare className="size-3 mr-1" />
                    Notas
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500">
                    <History className="size-3 mr-1" />
                    Timeline
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-5 pt-2">
                <AnimatePresence mode="wait">
                  {detailTab === 'info' && (
                    <motion.div
                      key="info"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
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
                    </motion.div>
                  )}
                  {detailTab === 'notes' && (
                    <motion.div
                      key="notes"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <NotesPanel entityType="process" entityId={detailProcess.id} />
                    </motion.div>
                  )}
                  {detailTab === 'timeline' && (
                    <motion.div
                      key="timeline"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProcessTimeline processId={detailProcess.id} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 flex-row sm:flex-row justify-between border-t pt-4 mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="active:scale-[0.98] transition-all hover:border-emerald-300 dark:hover:border-emerald-700"
                    onClick={() => setDetailOpen(false)}
                  >
                    Fechar
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {detailProcess.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 active:scale-[0.98] transition-all"
                      onClick={() => { setCloseProcess(detailProcess); setCloseOpen(true); }}
                    >
                      <Archive className="size-3.5 mr-1.5" />
                      Encerrar Processo
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de encerramento ── */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Processo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja encerrar o processo{' '}
              <span className="font-semibold">{closeProcess?.process_number}</span>?
              Esta acção marcará o processo como encerrado e poderá ser reaberto posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={closeMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
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
