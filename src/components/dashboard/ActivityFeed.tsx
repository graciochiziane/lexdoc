// ═══════════════════════════════════════════════════════════════
// LEXDOC — Feed de Actividade Recente
// Timeline de actividades com ícones e cores por tipo de acção
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  FileText,
  Briefcase,
  Users,
  Clock,
  Mail,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { activityApi, type ActivityItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Ícones e cores por tipo de acção
// ─────────────────────────────────────────
interface ActionStyle {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

function getActionStyle(action: string): ActionStyle {
  if (action.includes('CREATED') || action.includes('ACCEPTED'))
    return { icon: Plus, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-l-emerald-500' };
  if (action.includes('UPDATED'))
    return { icon: Pencil, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-l-blue-500' };
  if (action.includes('DELETED') || action.includes('ARCHIVED') || action.includes('REVOKED') || action.includes('DEACTIVATED') || action.includes('CLOSED'))
    return { icon: Trash2, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-l-red-500' };
  if (action.includes('LOGIN_SUCCESS'))
    return { icon: LogIn, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-l-violet-500' };
  if (action.includes('LOGIN_FAILED') || action.includes('LOCKED'))
    return { icon: ShieldCheck, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-l-orange-500' };
  if (action.includes('LOGOUT'))
    return { icon: LogOut, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-l-gray-400' };
  if (action.includes('PASSWORD') || action.includes('RESET'))
    return { icon: Mail, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-l-amber-500' };
  if (action.includes('INVITATION'))
    return { icon: UserPlus, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-l-teal-500' };
  return { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-l-muted-foreground' };
}

// ─────────────────────────────────────────
// Formatação de tempo relativo
// ═══════════════════════════════════════════════════════════════
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────
// Skeleton de carregamento
// ─────────────────────────────────────────
function ActivitySkeleton() {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────
function EmptyActivityState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-10 text-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-3"
      >
        <Activity className="size-7 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Sem actividade recente</p>
      <p className="text-xs text-muted-foreground mt-1">
        As acções da sua equipa aparecerão aqui.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function ActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity', 'recent'],
    queryFn: () => activityApi.recent(10),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const activities: ActivityItem[] = data?.data?.activities ?? [];

  return (
    <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="size-4 text-emerald-500" />
          Actividade Recente
        </CardTitle>
        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {activities.length > 0 ? `${activities.length} registos` : ''}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ActivitySkeleton />
        ) : activities.length === 0 ? (
          <EmptyActivityState />
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {activities.map((activity, i) => {
              const style = getActionStyle(activity.action);
              const Icon = style.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border-l-3 ${style.border} hover:bg-muted/50 transition-colors`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`size-3.5 ${style.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{activity.user_name}</span>
                      {' '}
                      <span className="text-muted-foreground">{activity.description}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
