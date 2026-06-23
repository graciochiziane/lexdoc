// ═══════════════════════════════════════════════════════════════
// LEXDOC — Gestão de Utilizadores
// Listagem, criação, edição e desactivação
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  UserPlus,
  Pencil,
  UserMinus,
  Users,
  Loader2,
  Shield,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
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
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200',
  ADVOGADO: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-cyan-200',
  SECRETARIO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200',
  CLIENT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200',
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
  ADMIN: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  ADVOGADO: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400',
  SECRETARIO: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  CLIENT: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

const ROLE_AVATAR_BORDER_COLORS: Record<string, string> = {
  ADMIN: 'border-emerald-300 dark:border-emerald-700',
  ADVOGADO: 'border-cyan-300 dark:border-cyan-700',
  SECRETARIO: 'border-amber-300 dark:border-amber-700',
  CLIENT: 'border-gray-300 dark:border-gray-600',
};

const ROLE_OPTIONS = ['ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT'];

// Stagger animations
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Relative time
// ─────────────────────────────────────────
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return 'ontem';
  if (diffD < 7) return `há ${diffD} dias`;
  return date.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Maputo' });
}

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyUsersState() {
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
        <Users className="size-10 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">
        Nenhum utilizador registado
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Crie o primeiro utilizador para começar.
      </p>
      <Button
        onClick={() => document.querySelector<HTMLButtonElement>('[data-action="create-user"]')?.click()}
        className="mt-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all"
        size="sm"
      >
        <UserPlus className="size-4 mr-1.5" />
        Criar Utilizador
      </Button>
    </motion.div>
  );
}

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

  // ── Diálogos ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', role: 'CLIENT' });

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: '' });

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<UserRecord | null>(null);

  // ── Query ──
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

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('Utilizador criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setCreateForm({ full_name: '', email: '', password: '', role: 'CLIENT' });
    },
    onError: () => toast.error('Erro ao criar utilizador.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { full_name?: string; email?: string; role?: string } }) => usersApi.update(id, data),
    onSuccess: () => {
      toast.success('Utilizador actualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditOpen(false);
      setEditUser(null);
    },
    onError: () => toast.error('Erro ao actualizar utilizador.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      toast.success('Utilizador desactivado.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeactivateOpen(false);
      setDeactivateUser(null);
    },
    onError: () => toast.error('Erro ao desactivar utilizador.'),
  });

  // ── Handlers ──
  const handleSearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);
  const handleCreate = useCallback(() => {
    if (!createForm.full_name || !createForm.email || !createForm.password) { toast.error('Preencha todos os campos obrigatórios.'); return; }
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

  const handleDeactivateOpen = useCallback((user: UserRecord) => { setDeactivateUser(user); setDeactivateOpen(true); }, []);
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
          <p className="text-sm text-muted-foreground mt-1">{meta?.total ?? 0} utilizadores registados</p>
        </div>
        {canManage && (
          <Button data-action="create-user" onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98] transition-all">
            <UserPlus className="size-4" />
            Novo Utilizador
          </Button>
        )}
      </div>

      {/* Pesquisa */}
      <div className="relative max-w-sm">
        <motion.div animate={search ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 0.15 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou email..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </motion.div>
      </div>

      {/* Tabela */}
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-0">
              <div className="flex gap-4 mb-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-20 rounded" />)}</div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3 border-b last:border-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-36 rounded hidden sm:block" />
                  <Skeleton className="h-6 w-24 rounded-full hidden md:block" />
                  <Skeleton className="h-4 w-20 rounded hidden lg:block" />
                  <Skeleton className="h-4 w-16 rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyUsersState />
          ) : (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Último Login</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <motion.tbody variants={staggerContainer} initial="hidden" animate="show" className="[&_tr:last-child]:border-0">
                    {users.map((user, i) => (
                      <motion.tr
                        key={user.id}
                        variants={staggerItem}
                        className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-all duration-150 hover:shadow-sm ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 text-xs font-bold ${ROLE_AVATAR_COLORS[user.role] ?? ''} ${ROLE_AVATAR_BORDER_COLORS[user.role] ?? ''}`}>
                              {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} title={user.is_active ? 'Activo' : 'Inactivo'} />
                              <div>
                                {user.full_name}
                                {user.id === currentUser?.id && (
                                  <span className="text-[10px] text-muted-foreground ml-1">(você)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-full text-[10px] shadow-sm ${ROLE_COLORS[user.role] ?? ''}`}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={`rounded-full text-[10px] shadow-sm flex items-center gap-1 w-fit ${
                              user.is_active
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200'
                            }`}
                          >
                            {user.is_active ? (
                              <><ShieldCheck className="size-3" /> Activo</>
                            ) : (
                              <><AlertTriangle className="size-3" /> Inactivo</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {user.last_login_at
                            ? relativeTime(user.last_login_at)
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && user.id !== currentUser?.id && (
                              <>
                                <Button variant="ghost" size="icon" className="size-8 active:scale-[0.95]" onClick={() => handleEditOpen(user)}>
                                  <Pencil className="size-3.5" />
                                </Button>
                                {user.is_active && (
                                  <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.95]" onClick={() => handleDeactivateOpen(user)}>
                                    <UserMinus className="size-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                </motion.tbody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="active:scale-[0.98]">Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {meta.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="active:scale-[0.98]">Próxima</Button>
        </div>
      )}

      {/* ── Diálogos ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw]">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <UserPlus className="size-5" />
              </div>
              <div>
                <p className="text-lg">Novo Utilizador</p>
                <DialogDescription className="text-white/80 mt-0.5">Crie uma nova conta de utilizador na plataforma.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Nome Completo *</Label>
              <Input id="create-name" placeholder="Nome do utilizador" value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input id="create-email" type="email" placeholder="email@exemplo.co.mz" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">Palavra-passe *</Label>
              <Input id="create-password" type="password" placeholder="Mínimo 8 caracteres" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98]">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Utilizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw]">
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Pencil className="size-5" />
              </div>
              <div>
                <p className="text-lg">Editar Utilizador</p>
                <DialogDescription className="text-white/80 mt-0.5">Actualize os dados do utilizador.</DialogDescription>
              </div>
            </DialogTitle>
          </div>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input id="edit-name" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="active:scale-[0.98]">Cancelar</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md active:scale-[0.98]">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              </div>
              Desactivar Utilizador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja desactivar o utilizador <span className="font-semibold text-foreground">{deactivateUser?.full_name}</span>? Esta acção pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivateMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white active:scale-[0.98]">
              {deactivateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
