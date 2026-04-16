// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Utilizadores
// Listagem, criação, edição e desactivação
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  UserPlus,
  Pencil,
  UserMinus,
  Users,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { usersApi, type UserRecord } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200',
  ADVOGADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  SECRETARIO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  CLIENT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
};

const ROLE_OPTIONS = ['ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT'];

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function UsersView() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'ADVOGADO';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Diálogo de criação ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'CLIENT',
  });

  // ── Diálogo de edição ──
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: '',
  });

  // ── Diálogo de desactivação ──
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<UserRecord | null>(null);

  // ── Query: listar utilizadores ──
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, page],
    queryFn: () => usersApi.list(params.toString()),
    staleTime: 30 * 1000,
  });

  const users: UserRecord[] = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutation: criar utilizador ──
  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('Utilizador criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setCreateForm({ full_name: '', email: '', password: '', role: 'CLIENT' });
    },
    onError: () => {
      toast.error('Erro ao criar utilizador.');
    },
  });

  // ── Mutation: editar utilizador ──
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { full_name?: string; email?: string; role?: string } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      toast.success('Utilizador actualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditOpen(false);
      setEditUser(null);
    },
    onError: () => {
      toast.error('Erro ao actualizar utilizador.');
    },
  });

  // ── Mutation: desactivar utilizador ──
  const deactivateMutation = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      toast.success('Utilizador desactivado.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeactivateOpen(false);
      setDeactivateUser(null);
    },
    onError: () => {
      toast.error('Erro ao desactivar utilizador.');
    },
  });

  // ── Handlers ──
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
    },
    [],
  );

  const handleCreate = useCallback(() => {
    if (!createForm.full_name || !createForm.email || !createForm.password) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    createMutation.mutate(createForm);
  }, [createForm, createMutation]);

  const handleEditOpen = useCallback((user: UserRecord) => {
    setEditUser(user);
    setEditForm({ full_name: user.full_name, email: user.email, role: user.role });
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data: editForm });
  }, [editUser, editForm, updateMutation]);

  const handleDeactivateOpen = useCallback((user: UserRecord) => {
    setDeactivateUser(user);
    setDeactivateOpen(true);
  }, []);

  const handleDeactivate = useCallback(() => {
    if (!deactivateUser) return;
    deactivateMutation.mutate(deactivateUser.id);
  }, [deactivateUser, deactivateMutation]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Utilizadores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meta?.total ?? 0} utilizadores registados
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="size-4" />
            Novo Utilizador
          </Button>
        )}
      </div>

      {/* Pesquisa */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
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
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum utilizador registado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie o primeiro utilizador para começar.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Último Login</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[user.role] ?? ''}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            user.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200'
                          }
                        >
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString('pt-MZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              timeZone: 'Africa/Maputo',
                            })
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && user.id !== currentUser?.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditOpen(user)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              {user.is_active && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  onClick={() => handleDeactivateOpen(user)}
                                >
                                  <UserMinus className="size-3.5" />
                                </Button>
                              )}
                            </>
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

      {/* ── Diálogo: Novo Utilizador ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Utilizador</DialogTitle>
            <DialogDescription>
              Crie uma nova conta de utilizador na plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Nome Completo *</Label>
              <Input
                id="create-name"
                placeholder="Nome do utilizador"
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="email@exemplo.co.mz"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">Palavra-passe *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              Criar Utilizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Editar Utilizador ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Utilizador</DialogTitle>
            <DialogDescription>
              Actualize os dados do utilizador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Confirmar Desactivação ── */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar Utilizador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja desactivar o utilizador{' '}
              <span className="font-semibold text-foreground">
                {deactivateUser?.full_name}
              </span>
              ? Esta acção pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deactivateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
