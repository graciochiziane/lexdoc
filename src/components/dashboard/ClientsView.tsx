// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Clientes
// Listagem, criação e edição de clientes do escritório
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Users,
  Loader2,
  Building2,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clientsApi, type ClientRecord } from '@/lib/api-client';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const CLIENT_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  EMPRESA: 'Empresa',
};

const CLIENT_TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-cyan-200',
  EMPRESA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
};

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyClientsState() {
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
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-950/60 dark:to-cyan-900/30 flex items-center justify-center mb-4"
      >
        <Users className="size-10 text-cyan-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">
        Nenhum cliente registado
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Adicione o primeiro cliente para começar.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Formulário vazio
// ─────────────────────────────────────────
const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  client_type: 'INDIVIDUAL',
  notes: '',
};

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function ClientsView() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Diálogo de criação ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  // ── Diálogo de edição ──
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRecord | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // ── Query: listar clientes ──
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: () => clientsApi.list(params.toString()),
    staleTime: 30 * 1000,
  });

  const clients: ClientRecord[] = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutation: criar cliente ──
  const createMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      toast.success('Cliente criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
    },
    onError: () => {
      toast.error('Erro ao criar cliente.');
    },
  });

  // ── Mutation: editar cliente ──
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data: updateData,
    }: {
      id: string;
      data: {
        full_name?: string;
        email?: string;
        phone?: string;
        address?: string;
        client_type?: string;
        notes?: string;
      };
    }) => clientsApi.update(id, updateData),
    onSuccess: () => {
      toast.success('Cliente actualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditOpen(false);
      setEditClient(null);
    },
    onError: () => {
      toast.error('Erro ao actualizar cliente.');
    },
  });

  // ── Handlers ──
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleCreate = useCallback(() => {
    if (!createForm.full_name) {
      toast.error('O nome é obrigatório.');
      return;
    }
    createMutation.mutate(createForm);
  }, [createForm, createMutation]);

  const handleEditOpen = useCallback((client: ClientRecord) => {
    setEditClient(client);
    setEditForm({
      full_name: client.full_name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      client_type: client.client_type,
      notes: client.notes ?? '',
    });
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editClient) return;
    updateMutation.mutate({
      id: editClient.id,
      data: editForm,
    });
  }, [editClient, editForm, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meta?.total ?? 0} clientes registados
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all"
        >
          <Plus className="size-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Pesquisa */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela */}
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <EmptyClientsState />
          ) : (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client, i) => (
                    <TableRow
                      key={client.id}
                      className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {client.client_type === 'EMPRESA' ? (
                            <Building2 className="size-4 text-amber-500 shrink-0" />
                          ) : (
                            <User className="size-4 text-cyan-500 shrink-0" />
                          )}
                          {client.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {client.email ?? '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {client.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[10px] shadow-sm ${CLIENT_TYPE_COLORS[client.client_type] ?? ''}`}
                        >
                          {CLIENT_TYPE_LABELS[client.client_type] ?? client.client_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[10px] shadow-sm ${
                            client.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200'
                          }`}
                        >
                          {client.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 active:scale-[0.95]"
                          onClick={() => handleEditOpen(client)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="active:scale-[0.98]">
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {meta.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="active:scale-[0.98]">
            Próxima
          </Button>
        </div>
      )}

      {/* ── Diálogo: Novo Cliente ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>Adicione um novo cliente ao escritório.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Nome Completo *</Label>
              <Input id="client-name" placeholder="Nome do cliente" value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client-email">Email</Label>
                <Input id="client-email" type="email" placeholder="email@exemplo.co.mz" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-phone">Telefone</Label>
                <Input id="client-phone" placeholder="+258 84 000 0000" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-address">Endereço</Label>
              <Input id="client-address" placeholder="Endereço completo" value={createForm.address} onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de Cliente</Label>
              <Select value={createForm.client_type} onValueChange={(v) => setCreateForm((f) => ({ ...f, client_type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-notes">Notas</Label>
              <Textarea id="client-notes" placeholder="Observações adicionais..." value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98]">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Editar Cliente ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Actualize os dados do cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-client-name">Nome Completo</Label>
              <Input id="edit-client-name" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-client-email">Email</Label>
                <Input id="edit-client-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-client-phone">Telefone</Label>
                <Input id="edit-client-phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-client-address">Endereço</Label>
              <Input id="edit-client-address" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de Cliente</Label>
              <Select value={editForm.client_type} onValueChange={(v) => setEditForm((f) => ({ ...f, client_type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-client-notes">Notas</Label>
              <Textarea id="edit-client-notes" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98]">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
