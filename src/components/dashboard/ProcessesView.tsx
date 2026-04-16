// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Processos Jurídicos
// Listagem, criação, filtros e detalhes
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Eye,
  Briefcase,
  Loader2,
  Filter,
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
import { processesApi, clientsApi, type ProcessRecord, type ClientRecord } from '@/lib/api-client';

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
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
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

// ─────────────────────────────────────────
// Badge genérico
// ─────────────────────────────────────────
function ColoredBadge({ value, labels, colors }: { value: string; labels: Record<string, string>; colors: Record<string, string> }) {
  return (
    <Badge variant="outline" className={colors[value] ?? ''}>
      {labels[value] ?? value}
    </Badge>
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
// Componente
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

  // ── Query: clientes (para select) ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => clientsApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const clientList: ClientRecord[] = clientsData?.data ?? [];

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
    },
    onError: () => {
      toast.error('Erro ao encerrar processo.');
    },
  });

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
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="size-4" />
          Novo Processo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Pesquisa */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar processo..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
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
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Briefcase className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum processo encontrado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste os filtros ou crie um novo processo.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
              <Table>
                <TableHeader>
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
                  {processes.map((process) => (
                    <TableRow key={process.id}>
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
                          ? new Date(process.closed_at).toLocaleDateString('pt-MZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              timeZone: 'Africa/Maputo',
                            })
                          : new Date(process.opened_at).toLocaleDateString('pt-MZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              timeZone: 'Africa/Maputo',
                            })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => {
                              setDetailProcess(process);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {process.status === 'ACTIVE' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => {
                                setCloseProcess(process);
                                setCloseOpen(true);
                              }}
                            >
                              <Briefcase className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
          >
            Próxima
          </Button>
        </div>
      )}

      {/* ── Diálogo: Novo Processo ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Processo</DialogTitle>
            <DialogDescription>
              Crie um novo processo jurídico.
            </DialogDescription>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Detalhes do Processo ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailProcess?.process_number}
            </DialogTitle>
            <DialogDescription>{detailProcess?.title}</DialogDescription>
          </DialogHeader>
          {detailProcess && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Área</p>
                  <ColoredBadge
                    value={detailProcess.area}
                    labels={AREA_LABELS}
                    colors={AREA_COLORS}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prioridade</p>
                  <ColoredBadge
                    value={detailProcess.priority}
                    labels={PRIORITY_LABELS}
                    colors={PRIORITY_COLORS}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <ColoredBadge
                    value={detailProcess.status}
                    labels={STATUS_LABELS}
                    colors={STATUS_COLORS}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aberto em</p>
                  <p className="text-sm font-medium">
                    {new Date(detailProcess.opened_at).toLocaleDateString('pt-MZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      timeZone: 'Africa/Maputo',
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                <p className="text-sm font-medium">
                  {detailProcess.client?.full_name ?? '—'}
                </p>
              </div>

              {detailProcess.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm whitespace-pre-wrap">{detailProcess.description}</p>
                </div>
              )}

              {(detailProcess.court || detailProcess.judge || detailProcess.opposing_party) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detailProcess.court && (
                      <div>
                        <p className="text-xs text-muted-foreground">Tribunal</p>
                        <p className="text-sm">{detailProcess.court}</p>
                      </div>
                    )}
                    {detailProcess.judge && (
                      <div>
                        <p className="text-xs text-muted-foreground">Juiz</p>
                        <p className="text-sm">{detailProcess.judge}</p>
                      </div>
                    )}
                    {detailProcess.opposing_party && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Parte Contrária</p>
                        <p className="text-sm">{detailProcess.opposing_party}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Confirmar Encerramento ── */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Processo</AlertDialogTitle>
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
