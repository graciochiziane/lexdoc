// ═══════════════════════════════════════════════════════════════
// LEXDOC — Centro de Notificações (vista completa)
// Substitui o dropdown do NotificationPanel com uma vista expandida
// Marcar como lido, filtrar por tipo, pesquisar, agrupar por data
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  Lock,
  FileCheck,
  Briefcase,
  Users,
  FileText,
  Calendar,
  CheckCheck,
  Search,
  Sparkles,
  Inbox,
  Clock,
  Shield,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationsApi, type NotificationItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type FilterTab = 'all' | 'unread' | 'processes' | 'documents' | 'deadlines';
type DateGroup = 'Hoje' | 'Ontem' | 'Esta semana' | 'Mais antigas';

interface GroupedNotifications {
  group: DateGroup;
  items: NotificationItem[];
}

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────

// Configuração de ícones e cores por acção
const ACTION_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  CREATE: {
    icon: Plus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Criou',
  },
  UPDATE: {
    icon: Pencil,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Actualizou',
  },
  DELETE: {
    icon: Trash2,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Eliminou',
  },
  LOGIN_SUCCESS: {
    icon: LogIn,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    label: 'Iniciou sessão',
  },
  PASSWORD_CHANGE: {
    icon: Lock,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    label: 'Alterou palavra-passe',
  },
  CLOSE: {
    icon: FileCheck,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    label: 'Encerrou',
  },
  DEACTIVATE: {
    icon: Trash2,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Desactivou',
  },
  USER_CREATED: {
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Criou utilizador',
  },
  NOTE_CREATED: {
    icon: Plus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Criou nota',
  },
  NOTE_UPDATED: {
    icon: Pencil,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Actualizou nota',
  },
  NOTE_DELETED: {
    icon: Trash2,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Eliminou nota',
  },
  INVITATION_CREATED: {
    icon: Users,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Enviou convite',
  },
  INVITATION_ACCEPTED: {
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Aceitou convite',
  },
};

const ENTITY_LABELS: Record<string, string> = {
  LegalProcess: 'Processo',
  Client: 'Cliente',
  Document: 'Documento',
  Deadline: 'Prazo',
  User: 'Utilizador',
  Profile: 'Perfil',
  GlobalSearch: 'Pesquisa',
  Firm: 'Escritório',
  PROCESS: 'Processo',
  CLIENT: 'Cliente',
  DOCUMENT: 'Documento',
  DEADLINE: 'Prazo',
  USER: 'Utilizador',
  PROFILE: 'Perfil',
  FIRM: 'Escritório',
};

const FILTER_TABS: Array<{ id: FilterTab; label: string; icon?: React.ElementType }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas', icon: EyeOff },
  { id: 'processes', label: 'Processos', icon: Briefcase },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'deadlines', label: 'Prazos', icon: Calendar },
];

const DATE_GROUP_ORDER: DateGroup[] = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const READ_IDS_KEY = 'lexdoc_read_notification_ids';

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(READ_IDS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // Silencioso
  }
  return new Set();
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // Silencioso
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
}

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const date = new Date(dateStr);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  if (date >= todayStart) return 'Hoje';
  if (date >= yesterdayStart) return 'Ontem';
  if (date >= weekStart) return 'Esta semana';
  return 'Mais antigas';
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? {
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: action,
  };
}

function getNotificationDescription(n: NotificationItem): string {
  const actionCfg = getActionConfig(n.action);
  const entityLabel = ENTITY_LABELS[n.entity_type] ?? n.entity_type;
  const metadata = n.metadata as Record<string, string> | null;

  let description = `${n.user_name} ${actionCfg.label.toLowerCase()}`;
  if (entityLabel && entityLabel !== 'Pesquisa') {
    description += ` ${entityLabel}`;
  }
  if (metadata?.title) {
    description += `: ${metadata.title}`;
  } else if (metadata?.full_name) {
    description += `: ${metadata.full_name}`;
  } else if (metadata?.process_number) {
    description += ` ${metadata.process_number}`;
  }
  return description;
}

function groupNotificationsByDate(notifications: NotificationItem[]): GroupedNotifications[] {
  const groups: Record<string, NotificationItem[]> = {};

  for (const notification of notifications) {
    const dateGroup = getDateGroup(notification.created_at);
    if (!groups[dateGroup]) {
      groups[dateGroup] = [];
    }
    groups[dateGroup].push(notification);
  }

  return DATE_GROUP_ORDER
    .filter((group) => groups[group] && groups[group].length > 0)
    .map((group) => ({
      group,
      items: groups[group],
    }));
}

function matchesFilter(n: NotificationItem, filter: FilterTab, readIds: Set<string>): boolean {
  const et = n.entity_type.toUpperCase();
  switch (filter) {
    case 'unread': return !readIds.has(n.id);
    case 'processes': return et === 'LEGALPROCESS' || et === 'PROCESS';
    case 'documents': return et === 'DOCUMENT';
    case 'deadlines': return et === 'DEADLINE';
    default: return true;
  }
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function NotificationsCenter() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return getReadIds();
  });

  // ── Query: buscar notificações ──
  const { data: allNotifications = [], isLoading } = useQuery({
    queryKey: ['notifications-center'],
    queryFn: async () => {
      // Buscar todas as páginas
      const res = await notificationsApi.list('limit=100');
      if (res.success && res.data) return res.data.notifications;
      return [];
    },
    staleTime: 30000,
  });

  // ── Filtrar e pesquisar ──
  const filteredNotifications = useMemo(() => {
    let filtered = allNotifications.filter((n) => matchesFilter(n, filter, readIds));

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((n) => {
        const desc = getNotificationDescription(n);
        return desc.toLowerCase().includes(q) ||
          n.user_name.toLowerCase().includes(q) ||
          (n.entity_type ?? '').toLowerCase().includes(q);
      });
    }

    return filtered;
  }, [allNotifications, filter, search, readIds]);

  // ── Agrupar por data ──
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  // ── Contagem de não lidas ──
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !readIds.has(n.id)).length;
  }, [allNotifications, readIds]);

  // ── Handlers ──
  const handleMarkAsRead = useCallback((id: string) => {
    const newIds = new Set(readIds);
    newIds.add(id);
    setReadIds(newIds);
    saveReadIds(newIds);
  }, [readIds]);

  const handleMarkAllAsRead = useCallback(() => {
    const newIds = new Set(readIds);
    allNotifications.forEach((n) => newIds.add(n.id));
    setReadIds(newIds);
    saveReadIds(newIds);
  }, [readIds, allNotifications]);

  const unreadBadgeCount = filter === 'unread' ? unreadCount : unreadCount;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="size-6 text-emerald-600 dark:text-emerald-400" />
            Notificações
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Actividades recentes do escritório
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm">
              {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="text-xs active:scale-[0.98] transition-transform"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="size-3.5 mr-1.5" />
              Marcar tudo como lido
            </Button>
          </div>
        )}
      </div>

      {/* Barra de pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar notificações..."
          className="pl-9 bg-background border-border/50"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="size-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 whitespace-nowrap active:scale-[0.97] ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon && <tab.icon className="size-3.5" />}
              {tab.label}
              {tab.id === 'unread' && unreadBadgeCount > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0 leading-4 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {unreadBadgeCount > 99 ? '99+' : unreadBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista de notificações */}
      <div className="space-y-1">
        {isLoading ? (
          // Skeleton loader
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <motion.div
              animate={{
                y: [0, -8, 0],
                rotate: [0, 3, -3, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/40 flex items-center justify-center mb-4"
            >
              {search ? (
                <Search className="size-9 text-emerald-500/60" />
              ) : filter === 'unread' ? (
                <Eye className="size-9 text-emerald-500/60" />
              ) : (
                <Bell className="size-9 text-emerald-500/60" />
              )}
            </motion.div>
            <h3 className="text-lg font-semibold text-muted-foreground">
              {search
                ? 'Nenhum resultado encontrado'
                : filter === 'unread'
                  ? 'Todas as notificações foram lidas'
                  : 'Sem notificações'}
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
              {search
                ? `Nenhuma notificação corresponde a "${search}"`
                : filter === 'unread'
                  ? 'Novas actividades do escritório aparecerão aqui'
                  : 'As actividades do escritório serão registadas aqui'}
            </p>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-emerald-600 dark:text-emerald-400"
                onClick={() => setSearch('')}
              >
                <X className="size-3.5 mr-1" />
                Limpar pesquisa
              </Button>
            )}
          </motion.div>
        ) : (
          // Grouped notifications
          <div>
            {groupedNotifications.map((group, groupIdx) => (
              <div key={group.group} className="mb-4 last:mb-0">
                {/* Date group header */}
                <div className="flex items-center gap-2 px-2 py-2 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.group}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground/60">
                    {group.items.length}
                  </span>
                </div>

                {/* Notification items */}
                <AnimatePresence>
                  {group.items.map((notification, idx) => {
                    const config = getActionConfig(notification.action);
                    const ActionIcon = config.icon;
                    const description = getNotificationDescription(notification);
                    const isRead = readIds.has(notification.id);

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: idx * 0.03,
                        }}
                        className={`relative flex items-start gap-3 px-3 sm:px-4 py-3 rounded-lg transition-all duration-150 hover:bg-accent/50 group ${
                          !isRead ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                        }`}
                        onClick={() => !isRead && handleMarkAsRead(notification.id)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* Unread dot */}
                        {!isRead && (
                          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}

                        {/* Action icon */}
                        <div className={`flex items-center justify-center size-9 rounded-lg ${config.bgColor} shrink-0 mt-0.5 ml-1`}>
                          <ActionIcon className={`size-4 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug break-words ${!isRead ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                            {description}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {timeAgo(notification.created_at)}
                          </p>
                        </div>

                        {/* Mark as read button */}
                        {!isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            title="Marcar como lida"
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé com contagem */}
      {!isLoading && allNotifications.length > 0 && (
        <div className="text-center pt-4 border-t">
          <p className="text-xs text-muted-foreground/60">
            Mostrando {filteredNotifications.length} de {allNotifications.length} notificações
          </p>
        </div>
      )}
    </div>
  );
}
