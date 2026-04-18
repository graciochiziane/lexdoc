// ═══════════════════════════════════════════════════════════════
// LEXDOC — Galeria de Modelos de Processo (Templates)
// CRUD com galeria de cards, filtro por área, usar modelo
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  FileCode2,
  Loader2,
  Pencil,
  Trash2,
  Copy,
  CheckSquare,
  Sparkles,
  ListChecks,
  X,
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
import { templatesApi, clientsApi, type TemplateRecord, type ClientRecord } from '@/lib/api-client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const AREA_LABELS: Record<string, string> = {
  CIVIL: 'Civil',
  PENAL: 'Penal',
  COMERCIAL: 'Comercial',
  TRABALHO: 'Trabalho',
  FAMILIA: 'Família',
  FISCAL: 'Fiscal',
  ADMINISTRATIVO: 'Administrativo',
  CONSTITUCIONAL: 'Constitucional',
  OUTRO: 'Outro',
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
  OUTRO: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const AREAS = Object.keys(AREA_LABELS);
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const EMPTY_TEMPLATE_FORM = {
  title: '',
  description: '',
  area: 'CIVIL',
  default_priority: 'MEDIUM',
  checklist_items: [{ title: '', description: '' }],
};

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export function TemplatesView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_TEMPLATE_FORM);
  const [useForm, setUseForm] = useState({ client_id: '', process_number: '' });

  // ── Query: templates ──
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (areaFilter !== 'all') params.set('area', areaFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['templates', search, areaFilter],
    queryFn: () => templatesApi.list(params.toString()),
    staleTime: 30 * 1000,
  });

  const templates: TemplateRecord[] = data?.data ?? [];

  // ── Query: clients for use form ──
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'template-use'],
    queryFn: () => clientsApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const clientList: ClientRecord[] = clientsData?.data ?? [];

  // ── Mutation: create ──
  const createMutation = useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      toast.success('Modelo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setCreateOpen(false);
      setCreateForm(EMPTY_TEMPLATE_FORM);
    },
    onError: () => toast.error('Erro ao criar modelo.'),
  });

  // ── Mutation: update ──
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof templatesApi.update>[1] }) =>
      templatesApi.update(id, data),
    onSuccess: () => {
      toast.success('Modelo actualizado!');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => toast.error('Erro ao actualizar modelo.'),
  });

  // ── Mutation: delete ──
  const deleteMutation = useMutation({
    mutationFn: templatesApi.remove,
    onSuccess: () => {
      toast.success('Modelo removido.');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDeleteOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => toast.error('Erro ao remover modelo.'),
  });

  // ── Mutation: use template ──
  const useMutation2 = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { client_id: string; process_number: string } }) =>
      templatesApi.use(id, data),
    onSuccess: () => {
      toast.success('Processo criado a partir do modelo!');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setUseOpen(false);
      setUseForm({ client_id: '', process_number: '' });
      setSelectedTemplate(null);
    },
    onError: () => toast.error('Erro ao criar processo.'),
  });

  // ── Checklist helpers ──
  const addChecklistItem = (setter: typeof setCreateForm, form: typeof createForm) => {
    setter({ ...form, checklist_items: [...form.checklist_items, { title: '', description: '' }] });
  };

  const removeChecklistItem = (setter: typeof setCreateForm, form: typeof createForm, index: number) => {
    setter({ ...form, checklist_items: form.checklist_items.filter((_, i) => i !== index) });
  };

  const updateChecklistItem = (setter: typeof setCreateForm, form: typeof createForm, index: number, field: 'title' | 'description', value: string) => {
    const updated = [...form.checklist_items];
    updated[index] = { ...updated[index], [field]: value };
    setter({ ...form, checklist_items: updated });
  };

  // ── Handlers ──
  const handleCreate = useCallback(() => {
    if (!createForm.title) { toast.error('Título é obrigatório.'); return; }
    const items = createForm.checklist_items.filter((i) => i.title.trim());
    createMutation.mutate({
      title: createForm.title,
      description: createForm.description || undefined,
      area: createForm.area,
      default_priority: createForm.default_priority,
      checklist_items: items,
    });
  }, [createForm, createMutation]);

  const handleEditOpen = useCallback((template: TemplateRecord) => {
    setSelectedTemplate(template);
    let items: Array<{ title: string; description: string }> = [];
    try { items = JSON.parse(template.checklist_items); } catch { items = []; }
    setEditForm({
      title: template.title,
      description: template.description || '',
      area: template.area,
      default_priority: template.default_priority,
      checklist_items: items.length > 0 ? items : [{ title: '', description: '' }],
    });
    setEditOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!selectedTemplate || !editForm.title) return;
    const items = editForm.checklist_items.filter((i) => i.title.trim());
    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        title: editForm.title,
        description: editForm.description || undefined,
        area: editForm.area,
        default_priority: editForm.default_priority,
        checklist_items: items,
      },
    });
  }, [selectedTemplate, editForm, updateMutation]);

  const handleUseOpen = useCallback((template: TemplateRecord) => {
    setSelectedTemplate(template);
    setUseForm({ client_id: '', process_number: '' });
    setUseOpen(true);
  }, []);

  const handleUse = useCallback(() => {
    if (!selectedTemplate || !useForm.client_id || !useForm.process_number) {
      toast.error('Preencha todos os campos.');
      return;
    }
    useMutation2.mutate({
      id: selectedTemplate.id,
      data: useForm,
    });
  }, [selectedTemplate, useForm, useMutation2]);

  // Parse checklist count helper
  const getChecklistCount = (items: string): number => {
    try { return JSON.parse(items).filter((i: { title: string }) => i.title.trim()).length; }
    catch { return 0; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Modelos de Processo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length} modelo{templates.length !== 1 ? 's' : ''} disponível{templates.length !== 1 ? 'is' : ''}
          </p>
        </div>
        <Button
          onClick={() => { setCreateForm(EMPTY_TEMPLATE_FORM); setCreateOpen(true); }}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all"
        >
          <Plus className="size-4" />
          Novo Modelo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Todas as áreas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {AREAS.map((area) => (
              <SelectItem key={area} value={area}>{AREA_LABELS[area]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-xl"><CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-4"
          >
            <FileCode2 className="size-10 text-emerald-500" />
          </motion.div>
          <p className="text-sm font-medium">Nenhum modelo encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Crie o seu primeiro modelo de processo.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {templates.map((template, idx) => {
              const count = getChecklistCount(template.checklist_items);
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="group"
                >
                  <Card className="hover:shadow-lg transition-all duration-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-500 h-1.5" />
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{template.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.created_by.full_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => handleEditOpen(template)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-red-500 hover:text-red-600" onClick={() => { setSelectedTemplate(template); setDeleteOpen(true); }}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>

                      {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={`text-[10px] rounded-full ${AREA_COLORS[template.area] ?? ''}`}>
                          {AREA_LABELS[template.area] ?? template.area}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200">
                          {PRIORITY_LABELS[template.default_priority] ?? template.default_priority}
                        </Badge>
                        {count > 0 && (
                          <Badge variant="outline" className="text-[10px] rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-cyan-200">
                            <ListChecks className="size-2.5 mr-0.5" />
                            {count} {count === 1 ? 'item' : 'itens'}
                          </Badge>
                        )}
                      </div>

                      <div className="pt-2">
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs active:scale-[0.98]"
                          onClick={() => handleUseOpen(template)}
                        >
                          <Copy className="size-3 mr-1.5" />
                          Usar Modelo
                        </Button>
                      </div>

                      <p className="text-[10px] text-muted-foreground/60 text-right">
                        {format(new Date(template.created_at), "dd MMM yyyy", { locale: pt })}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Dialog: Create Template ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <FileCode2 className="size-5" />
              </div>
              <div>
                <p className="text-lg">Novo Modelo de Processo</p>
                <DialogDescription className="text-white/80 mt-0.5">Crie um modelo reutilizável.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input placeholder="Nome do modelo" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição do modelo..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Área Jurídica</Label>
                <Select value={createForm.area} onValueChange={(v) => setCreateForm((f) => ({ ...f, area: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABELS[a]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade Padrão</Label>
                <Select value={createForm.default_priority} onValueChange={(v) => setCreateForm((f) => ({ ...f, default_priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CheckSquare className="size-3.5" /> Lista de Verificação
                </Label>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => addChecklistItem(setCreateForm, createForm)}>
                  <Plus className="size-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {createForm.checklist_items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-1.5">
                      <Input placeholder="Título do item" className="h-8 text-xs" value={item.title} onChange={(e) => updateChecklistItem(setCreateForm, createForm, idx, 'title', e.target.value)} />
                      <Input placeholder="Descrição (opcional)" className="h-7 text-[11px]" value={item.description} onChange={(e) => updateChecklistItem(setCreateForm, createForm, idx, 'description', e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 text-red-500 shrink-0 mt-1" onClick={() => removeChecklistItem(setCreateForm, createForm, idx)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Edit Template ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Pencil className="size-5" />
              </div>
              <div>
                <p className="text-lg">Editar Modelo</p>
                <DialogDescription className="text-white/80 mt-0.5">Modifique o modelo de processo.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Área</Label>
                <Select value={editForm.area} onValueChange={(v) => setEditForm((f) => ({ ...f, area: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABELS[a]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={editForm.default_priority} onValueChange={(v) => setEditForm((f) => ({ ...f, default_priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium flex items-center gap-1.5"><CheckSquare className="size-3.5" /> Lista de Verificação</Label>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => addChecklistItem(setEditForm, editForm)}>
                  <Plus className="size-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {editForm.checklist_items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-1.5">
                      <Input placeholder="Título do item" className="h-8 text-xs" value={item.title} onChange={(e) => updateChecklistItem(setEditForm, editForm, idx, 'title', e.target.value)} />
                      <Input placeholder="Descrição (opcional)" className="h-7 text-[11px]" value={item.description} onChange={(e) => updateChecklistItem(setEditForm, editForm, idx, 'description', e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 text-red-500 shrink-0 mt-1" onClick={() => removeChecklistItem(setEditForm, editForm, idx)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Use Template ── */}
      <Dialog open={useOpen} onOpenChange={setUseOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw]">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-lg">Usar Modelo</p>
                <DialogDescription className="text-white/80 mt-0.5">Crie um processo a partir do modelo.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          {selectedTemplate && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <FileCode2 className="size-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedTemplate.title}</p>
                  <p className="text-xs text-muted-foreground">{AREA_LABELS[selectedTemplate.area]} • {PRIORITY_LABELS[selectedTemplate.default_priority]}</p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Nº Processo *</Label>
                <Input placeholder="Ex: 123/2026" value={useForm.process_number} onChange={(e) => setUseForm((f) => ({ ...f, process_number: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <Select value={useForm.client_id} onValueChange={(v) => setUseForm((f) => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientList.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {getChecklistCount(selectedTemplate.checklist_items) > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckSquare className="size-3" />
                  {getChecklistCount(selectedTemplate.checklist_items)} item(ns) da lista de verificação serão criados como prazos.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseOpen(false)}>Cancelar</Button>
            <Button onClick={handleUse} disabled={useMutation2.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              {useMutation2.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Alert: Delete Template ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja eliminar o modelo &quot;{selectedTemplate?.title}&quot;? Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
