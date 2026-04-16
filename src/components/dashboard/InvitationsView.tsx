// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Convites Pendentes
// Listagem de convites com acções (ADMIN)
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Link2,
  Trash2,
  Mail,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { invitationsApi, type InvitationRecord } from '@/lib/api-client';
import { InvitationDialog } from './InvitationDialog';

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
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADVOGADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SECRETARIO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CLIENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
    icon: Clock,
  },
  ACCEPTED: {
    label: 'Aceite',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: 'Expirado',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
    icon: AlertCircle,
  },
};

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyInvitationsState() {
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
        <Send className="size-10 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">
        Nenhum convite enviado
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Envie um convite para adicionar novos membros ao escritório.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function InvitationsView() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [createOpen, setCreateOpen] = useState(false);

  // ── Query: listar convites ──
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['invitations', search, page],
    queryFn: () => invitationsApi.list(params.toString()),
    staleTime: 30 * 1000,
  });

  const invitations: InvitationRecord[] = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutation: revogar convite ──
  const revokeMutation = useMutation({
    mutationFn: invitationsApi.revoke,
    onSuccess: () => {
      toast.success('Convite revogado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: () => {
      toast.error('Erro ao revogar convite.');
    },
  });

  // ── Handlers ──
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleCopyLink = useCallback((email: string) => {
    toast.info('Copie o link do convite a partir do diálogo de criação.');
  }, []);

  const handleRevoke = useCallback((id: string) => {
    // Para revogar precisamos do token, mas a listagem não retorna o token
    // Precisamos chamar via ID
    if (window.confirm('Tem a certeza que deseja revogar este convite?')) {
      // Usamos uma abordagem diferente — chamamos a API com ID
      revokeMutation.mutate(id);
    }
  }, [revokeMutation]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Convites</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meta?.total ?? 0} convites
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all"
        >
          <Plus className="size-4" />
          Novo Convite
        </Button>
      </div>

      {/* Pesquisa */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por email..."
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
          ) : invitations.length === 0 ? (
            <EmptyInvitationsState />
          ) : (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="hidden sm:table-cell">Criado em</TableHead>
                    <TableHead className="hidden md:table-cell">Expira em</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation, i) => {
                    const statusConfig = STATUS_CONFIG[invitation.status] ?? STATUS_CONFIG.PENDING;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow
                        key={invitation.id}
                        className={`hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="size-4 text-muted-foreground shrink-0" />
                            {invitation.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full text-[10px] shadow-sm ${ROLE_COLORS[invitation.role] ?? ''}`}
                          >
                            {ROLE_LABELS[invitation.role] ?? invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {new Date(invitation.created_at).toLocaleDateString('pt-MZ')}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {new Date(invitation.expires_at).toLocaleDateString('pt-MZ')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full text-[10px] shadow-sm flex items-center gap-1 w-fit ${statusConfig.color}`}
                          >
                            <StatusIcon className="size-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {invitation.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.95]"
                              onClick={() => handleRevoke(invitation.id)}
                              title="Revogar convite"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Diálogo de criação */}
      <InvitationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
