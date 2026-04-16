// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Documentos
// Listagem, criação, filtros e gestão de documentos
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Search,
  FileText,
  Loader2,
  Trash2,
  Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { documentsApi, processesApi, type DocumentRecord, type ProcessRecord } from '@/lib/api-client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho', REVIEW: 'Em Revisão', APPROVED: 'Aprovado', ARCHIVED: 'Arquivado',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
  REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
};
const MIME_OPTIONS = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'DOC' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
];
const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF', 'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/png': 'PNG', 'image/jpeg': 'JPEG', 'text/plain': 'TXT',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: pt });
}

const EMPTY_FORM = { title: '', description: '', process_id: '', file_name: '', mime_type: 'application/pdf', file_size: 0, tags: '', is_confidential: false };

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyDocumentsState() {
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
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/60 dark:to-amber-900/30 flex items-center justify-center mb-4"
      >
        <FileText className="size-10 text-amber-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Nenhum documento encontrado</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">Ajuste os filtros ou crie um novo documento.</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function DocumentsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [createOpen, setCreateOpen] = useState(false);

  // ── Listen for FAB create event ──
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener('lexdoc:open-create', handler);
    return () => window.removeEventListener('lexdoc:open-create', handler);
  }, []);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<DocumentRecord | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState<DocumentRecord | null>(null);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['documents', search, statusFilter, page],
    queryFn: () => documentsApi.list(params.toString()),
    staleTime: 30 * 1000,
  });
  const documents: DocumentRecord[] = data?.data ?? [];
  const meta = data?.meta;

  const { data: processesData } = useQuery({
    queryKey: ['processes', 'all'],
    queryFn: () => processesApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const processList: ProcessRecord[] = processesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: documentsApi.create,
    onSuccess: () => { toast.success('Documento criado com sucesso!'); queryClient.invalidateQueries({ queryKey: ['documents'] }); setCreateOpen(false); setCreateForm(EMPTY_FORM); },
    onError: () => toast.error('Erro ao criar documento.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: updateData }: { id: string; data: { title?: string; description?: string; process_id?: string | null; file_name?: string; mime_type?: string; file_size?: number; tags?: string; is_confidential?: boolean; status?: string } }) => documentsApi.update(id, updateData),
    onSuccess: () => { toast.success('Documento actualizado com sucesso!'); queryClient.invalidateQueries({ queryKey: ['documents'] }); setEditOpen(false); setEditDocument(null); },
    onError: () => toast.error('Erro ao actualizar documento.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.update(id, { status: 'ARCHIVED' }),
    onSuccess: () => { toast.success('Documento arquivado com sucesso!'); queryClient.invalidateQueries({ queryKey: ['documents'] }); setDeleteOpen(false); setDeleteDocument(null); },
    onError: () => toast.error('Erro ao arquivar documento.'),
  });

  const handleSearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);
  const handleStatusFilter = useCallback((value: string) => { setStatusFilter(value); setPage(1); }, []);

  const handleCreate = useCallback(() => {
    if (!createForm.title || !createForm.file_name) { toast.error('Preencha os campos obrigatórios.'); return; }
    createMutation.mutate({ ...createForm, process_id: createForm.process_id || undefined, tags: createForm.tags || undefined });
  }, [createForm, createMutation]);

  const handleEditOpen = useCallback((doc: DocumentRecord) => {
    setEditDocument(doc);
    setEditForm({ title: doc.title, description: doc.description ?? '', process_id: doc.process_id ?? '', file_name: doc.file_name, mime_type: doc.mime_type, file_size: doc.file_size, tags: doc.tags, is_confidential: doc.is_confidential });
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editDocument) return;
    if (!editForm.title || !editForm.file_name) { toast.error('Preencha os campos obrigatórios.'); return; }
    updateMutation.mutate({ id: editDocument.id, data: { ...editForm, process_id: editForm.process_id || null, tags: editForm.tags || '' } });
  }, [editDocument, editForm, updateMutation]);

  const handleDelete = useCallback(() => { if (!deleteDocument) return; deleteMutation.mutate(deleteDocument.id); }, [deleteDocument, deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Documentos</h2>
          <p className="text-sm text-muted-foreground mt-1">{meta?.total ?? 0} documentos registados</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all">
          <Plus className="size-4" />
          Novo Documento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar documento..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={statusFilter} onValueChange={handleStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="DRAFT" className="text-xs">Rascunho</TabsTrigger>
            <TabsTrigger value="REVIEW" className="text-xs">Em Revisão</TabsTrigger>
            <TabsTrigger value="APPROVED" className="text-xs">Aprovado</TabsTrigger>
            <TabsTrigger value="ARCHIVED" className="text-xs">Arquivado</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="hover:shadow-lg transition-all duration-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
          ) : documents.length === 0 ? (
            <EmptyDocumentsState />
          ) : (
            <div className="max-h-[calc(100vh-340px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden md:table-cell">Processo</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Tamanho</TableHead>
                    <TableHead className="hidden lg:table-cell">Versão</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc, i) => (
                    <TableRow key={doc.id} className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="flex items-center gap-2">
                          {doc.is_confidential && <Lock className="size-3.5 text-red-500 shrink-0" />}
                          <span className="truncate">{doc.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{doc.process?.title ?? '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px] rounded-full shadow-sm">{MIME_LABELS[doc.mime_type] ?? doc.mime_type.split('/').pop()?.toUpperCase() ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">v{doc.version}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={`text-[10px] rounded-full shadow-sm ${STATUS_COLORS[doc.status] ?? ''}`}>{STATUS_LABELS[doc.status] ?? doc.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{formatDate(doc.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8 active:scale-[0.95]" onClick={() => handleEditOpen(doc)}><Pencil className="size-3.5" /></Button>
                          {doc.status !== 'ARCHIVED' && (
                            <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.95]" onClick={() => { setDeleteDocument(doc); setDeleteOpen(true); }}><Trash2 className="size-3.5" /></Button>
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

      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="active:scale-[0.98]">Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {meta.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="active:scale-[0.98]">Próxima</Button>
        </div>
      )}

      {/* ── Diálogos ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle><DialogDescription>Adicione um novo documento ao sistema.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="doc-title">Título *</Label><Input id="doc-title" placeholder="Título do documento" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="doc-desc">Descrição</Label><Textarea id="doc-desc" placeholder="Descrição do documento..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Processo</Label><Select value={createForm.process_id} onValueChange={(v) => setCreateForm((f) => ({ ...f, process_id: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar processo (opcional)" /></SelectTrigger><SelectContent>{processList.map((proc) => <SelectItem key={proc.id} value={proc.id}>{proc.process_number} — {proc.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="doc-filename">Nome do Ficheiro *</Label><Input id="doc-filename" placeholder="documento.pdf" value={createForm.file_name} onChange={(e) => setCreateForm((f) => ({ ...f, file_name: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Tipo MIME</Label><Select value={createForm.mime_type} onValueChange={(v) => setCreateForm((f) => ({ ...f, mime_type: v }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{MIME_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="doc-filesize">Tamanho (bytes)</Label><Input id="doc-filesize" type="number" min={0} placeholder="102400" value={createForm.file_size || ''} onChange={(e) => setCreateForm((f) => ({ ...f, file_size: parseInt(e.target.value) || 0 }))} /></div>
            <div className="grid gap-2"><Label htmlFor="doc-tags">Etiquetas</Label><Input id="doc-tags" placeholder="contrato, 2024, civil" value={createForm.tags} onChange={(e) => setCreateForm((f) => ({ ...f, tags: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Checkbox id="doc-confidential" checked={createForm.is_confidential} onCheckedChange={(checked) => setCreateForm((f) => ({ ...f, is_confidential: checked === true }))} /><Label htmlFor="doc-confidential" className="text-sm font-normal cursor-pointer">Documento confidencial</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98]">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}Criar Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Documento</DialogTitle><DialogDescription>Actualize os dados do documento.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="edit-doc-title">Título *</Label><Input id="edit-doc-title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-doc-desc">Descrição</Label><Textarea id="edit-doc-desc" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Processo</Label><Select value={editForm.process_id} onValueChange={(v) => setEditForm((f) => ({ ...f, process_id: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar processo (opcional)" /></SelectTrigger><SelectContent>{processList.map((proc) => <SelectItem key={proc.id} value={proc.id}>{proc.process_number} — {proc.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label htmlFor="edit-doc-filename">Nome do Ficheiro *</Label><Input id="edit-doc-filename" value={editForm.file_name} onChange={(e) => setEditForm((f) => ({ ...f, file_name: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Tipo MIME</Label><Select value={editForm.mime_type} onValueChange={(v) => setEditForm((f) => ({ ...f, mime_type: v }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{MIME_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="edit-doc-tags">Etiquetas</Label><Input id="edit-doc-tags" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Checkbox id="edit-doc-confidential" checked={editForm.is_confidential} onCheckedChange={(checked) => setEditForm((f) => ({ ...f, is_confidential: checked === true }))} /><Label htmlFor="edit-doc-confidential" className="text-sm font-normal cursor-pointer">Documento confidencial</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98]">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Documento</AlertDialogTitle>
            <AlertDialogDescription>Tem a certeza que deseja arquivar o documento <span className="font-semibold text-foreground">{deleteDocument?.title}</span>? O documento será marcado como arquivado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white active:scale-[0.98]">
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
