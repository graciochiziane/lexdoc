// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Notificações / Feed de Actividade
// Sino com badge de não lidos, dropdown com feed de actividade
// Agrupamento por data: Hoje, Ontem, Esta semana, Anteriores
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationsApi, type NotificationItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface NotificationPanelProps {
  onViewAll?: () => void;
}

type DateGroup = 'Hoje' | 'Ontem' | 'Esta semana' | 'Anteriores';

interface GroupedNotifications {
  group: DateGroup;
  items: NotificationItem[];
}

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
};

// Ícones por tipo de entidade
const ENTITY_ICONS: Record<string, React.ElementType> = {
  LegalProcess: Briefcase,
  Client: Users,
  Document: FileText,
  Deadline: Calendar,
  User: Users,
};

// Rótulos de entidade
const ENTITY_LABELS: Record<string, string> = {
  LegalProcess: 'Processo',
  Client: 'Cliente',
  Document: 'Documento',
  Deadline: 'Prazo',
  User: 'Utilizador',
  Profile: 'Perfil',
  GlobalSearch: 'Pesquisa',
  Firm: 'Escritório',
};

// Ordem dos grupos de data
const DATE_GROUP_ORDER: DateGroup[] = ['Hoje', 'Ontem', 'Esta semana', 'Anteriores'];

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────
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

  // Reset hours for date comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  if (date >= todayStart) return 'Hoje';
  if (date >= yesterdayStart) return 'Ontem';
  if (date >= weekStart) return 'Esta semana';
  return 'Anteriores';
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? {
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: action,
  };
}

// Descrição da notificação
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
  }
  return description;
}

// Agrupar notificações por data
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

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function NotificationPanel({ onViewAll }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Agrupar por data ──
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(notifications.slice(0, 10));
  }, [notifications]);

  // ── Buscar contagem de não lidos ──
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.unreadCount();
      if (res.success && res.data) {
        setUnreadCount(res.data.count);
      }
    } catch {
      // Silencioso
    }
  }, []);

  // ── Buscar notificações ──
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list('limit=20');
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Buscar ao abrir ──
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // ── Buscar contagem periodicamente ──
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ── Fechar ao clicar fora ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ── Marcar tudo como lido ──
  const handleMarkAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const allRead = !loading && notifications.length > 0 && unreadCount === 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Sino */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notificações"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </Button>

      {/* Painel dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-popover border rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold">Notificações</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full shadow-sm">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground hover:text-foreground active:scale-[0.98]"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="size-3 mr-1" />
                  Marcar tudo como lido
                </Button>
              )}
            </div>

            {/* Lista de notificações */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="size-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                /* Empty state — animated bell */
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <motion.div
                    animate={{
                      y: [0, -6, 0],
                      rotate: [0, -5, 5, -3, 3, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="size-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/40 flex items-center justify-center"
                  >
                    <Bell className="size-7 text-emerald-500/70" />
                  </motion.div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-500" />
                      Tudo em dia!
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      As actividades do escritório aparecerão aqui
                    </p>
                  </div>
                </div>
              ) : allRead ? (
                /* All read state */
                <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
                  <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <CheckCheck className="size-6 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Sem notificações não lidas</p>
                    <p className="text-xs text-muted-foreground/60">
                      Todas as notificações foram visualizadas
                    </p>
                  </div>
                </div>
              ) : (
                /* Grouped notifications */
                <div>
                  {groupedNotifications.map((group, groupIdx) => (
                    <div key={group.group}>
                      {/* Date group header */}
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 sticky top-0 z-10">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.group}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground/60">
                          {group.items.length}
                        </span>
                      </div>

                      {/* Notification items */}
                      {group.items.map((notification, idx) => {
                        const config = getActionConfig(notification.action);
                        const ActionIcon = config.icon;
                        const description = getNotificationDescription(notification);

                        return (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.25,
                              delay: (groupIdx * 0.05) + (idx * 0.04),
                              ease: 'easeOut',
                            }}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-default ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                          >
                            <div className={`flex items-center justify-center size-8 rounded-lg ${config.bgColor} shrink-0 mt-0.5`}>
                              <ActionIcon className={`size-4 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-snug">{description}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="size-2.5" />
                                {timeAgo(notification.created_at)}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé */}
            {notifications.length > 0 && (
              <div className="border-t px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-[0.98]"
                  onClick={() => {
                    setIsOpen(false);
                    onViewAll?.();
                  }}
                >
                  Ver tudo
                  <ExternalLink className="size-3 ml-1" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
