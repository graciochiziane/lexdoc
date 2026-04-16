// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Notificações / Feed de Actividade
// Sino com badge de não lidos, dropdown com feed de actividade
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { notificationsApi, type NotificationItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface NotificationPanelProps {
  onViewAll?: () => void;
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
  const entityIcon = ENTITY_ICONS[n.entity_type];
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

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function NotificationPanel({ onViewAll }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      const res = await notificationsApi.list('limit=10');
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
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="size-3 mr-1" />
                  Marcar tudo como lido
                </Button>
              )}
            </div>

            {/* Lista de notificações */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Bell className="size-6 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sem notificações</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      As actividades do escritório aparecerão aqui
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.slice(0, 5).map((notification) => {
                    const config = getActionConfig(notification.action);
                    const ActionIcon = config.icon;
                    const description = getNotificationDescription(notification);

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-default"
                      >
                        <div className={`flex items-center justify-center size-8 rounded-lg ${config.bgColor} shrink-0 mt-0.5`}>
                          <ActionIcon className={`size-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {timeAgo(notification.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            {notifications.length > 0 && (
              <div className="border-t px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
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
