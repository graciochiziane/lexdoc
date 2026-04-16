// ═══════════════════════════════════════════════════════════════
// LEXDOC — Trilha de Auditoria
// Visualização de logs de actividades com filtros
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  FileText,
  Settings,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auditApi, type AuditLogRecord } from '@/lib/api-client';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const TIMEZONE = 'Africa/Maputo';

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login bem-sucedido',
  LOGIN_FAILED: 'Tentativa de login falhada',
  LOGOUT: 'Sessão terminada',
  USER_CREATED: 'Utilizador criado',
  USER_UPDATED: 'Utilizador actualizado',
  USER_DEACTIVATED: 'Utilizador desactivado',
  CLIENT_CREATED: 'Cliente criado',
  CLIENT_UPDATED: 'Cliente actualizado',
  PROCESS_CREATED: 'Processo criado',
  PROCESS_UPDATED: 'Processo actualizado',
  PROCESS_CLOSED: 'Processo encerrado',
  DOCUMENT_CREATED: 'Documento criado',
  DOCUMENT_UPDATED: 'Documento actualizado',
  DOCUMENT_DELETED: 'Documento eliminado',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Utilizador',
  Client: 'Cliente',
  LegalProcess: 'Processo',
  Document: 'Documento',
  AuditLog: 'Auditoria',
  System: 'Sistema',
};

const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  LOGIN_SUCCESS: { icon: LogIn, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  LOGIN_FAILED: { icon: LogIn, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
  LOGOUT: { icon: LogOut, color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800' },
  USER_CREATED: { icon: UserPlus, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40' },
  USER_UPDATED: { icon: Settings, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  USER_DEACTIVATED: { icon: UserMinus, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
  CLIENT_CREATED: { icon: UserPlus, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40' },
  CLIENT_UPDATED: { icon: Settings, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  PROCESS_CREATED: { icon: FileText, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  PROCESS_UPDATED: { icon: Settings, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  PROCESS_CLOSED: { icon: FileText, color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800' },
  DOCUMENT_CREATED: { icon: FileText, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  DOCUMENT_UPDATED: { icon: Settings, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  DOCUMENT_DELETED: { icon: FileText, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
};

const ACTION_OPTIONS = [
  'all',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'PROCESS_CREATED',
  'PROCESS_UPDATED',
  'PROCESS_CLOSED',
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
];

const ENTITY_OPTIONS = [
  'all',
  'User',
  'Client',
  'LegalProcess',
  'Document',
];

// ─────────────────────────────────────────
// Formatação de data
// ─────────────────────────────────────────
function formatAuditDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-MZ', {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

// ─────────────────────────────────────────
// Ícone por tipo de acção
// ─────────────────────────────────────────
function ActionIcon({ action }: { action: string }) {
  const config = ACTION_ICONS[action] ?? {
    icon: Shield,
    color: 'text-muted-foreground bg-muted',
  };
  const IconComp = config.icon;
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
      <IconComp className="size-4" />
    </div>
  );
}

// ─────────────────────────────────────────
// Vista em linha temporal
// ─────────────────────────────────────────
function TimelineView({ logs }: { logs: AuditLogRecord[] }) {
  return (
    <div className="relative space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto">
      {/* Linha vertical */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {logs.map((log) => (
        <div key={log.id} className="relative flex items-start gap-4 py-3 pl-1">
          {/* Marcador na linha */}
          <div className="relative z-10 mt-1">
            <ActionIcon action={log.action} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0 bg-muted/30 rounded-lg p-3 hover:bg-muted/60 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {ACTION_LABELS[log.action] ?? log.action}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.user_name ?? 'Sistema'}{' '}
                  {log.entity_type && (
                    <>
                      — {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                      {log.entity_id && (
                        <span className="ml-1 font-mono text-[10px] opacity-60">
                          #{log.entity_id.slice(0, 6)}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {formatAuditDate(log.created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Vista em tabela
// ─────────────────────────────────────────
function TableView({ logs }: { logs: AuditLogRecord[] }) {
  return (
    <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Utilizador</TableHead>
            <TableHead className="hidden sm:table-cell">Acção</TableHead>
            <TableHead className="hidden md:table-cell">Entidade</TableHead>
            <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-sm font-mono whitespace-nowrap">
                {formatAuditDate(log.created_at)}
              </TableCell>
              <TableCell className="text-sm">
                {log.user_name ?? 'Sistema'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className="text-xs">
                  {ACTION_LABELS[log.action] ?? log.action}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {ENTITY_LABELS[log.entity_type] ?? log.entity_type ?? '—'}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                {log.metadata ?? log.new_values ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function AuditView() {
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [page, setPage] = useState(1);
  const limit = 20;

  // ── Query: logs de auditoria ──
  const params = new URLSearchParams();
  if (actionFilter !== 'all') params.set('action', actionFilter);
  if (entityFilter !== 'all') params.set('entity_type', entityFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'logs', actionFilter, entityFilter, page],
    queryFn: () => auditApi.logs(params.toString()),
    staleTime: 30 * 1000,
  });

  const logs: AuditLogRecord[] = data?.data ?? [];
  const meta = data?.meta;

  // ── Handlers ──
  const handleActionFilter = useCallback((value: string) => {
    setActionFilter(value);
    setPage(1);
  }, []);

  const handleEntityFilter = useCallback((value: string) => {
    setEntityFilter(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trilha de Auditoria</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {meta?.total ?? 0} registos de actividade
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <Select value={actionFilter} onValueChange={handleActionFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <Filter className="size-3 mr-1" />
              <SelectValue placeholder="Tipo de acção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as acções</SelectItem>
              {ACTION_OPTIONS.filter((o) => o !== 'all').map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action] ?? action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={handleEntityFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Tipo de entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {ENTITY_OPTIONS.filter((o) => o !== 'all').map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {ENTITY_LABELS[entity] ?? entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as 'timeline' | 'table')}
        >
          <TabsList className="h-9">
            <TabsTrigger value="timeline" className="text-xs">
              Linha Temporal
            </TabsTrigger>
            <TabsTrigger value="table" className="text-xs">
              Tabela
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conteúdo */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Shield className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum registo de auditoria
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A actividade dos utilizadores será registada aqui.
              </p>
            </div>
          ) : viewMode === 'timeline' ? (
            <TimelineView logs={logs} />
          ) : (
            <TableView logs={logs} />
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
    </div>
  );
}
