// ═══════════════════════════════════════════════════════════════
// LEXDOC — Sino de Notificações (botão simples)
// Substitui o NotificationPanel dropdown com navegação para o centro de notificações
// ═══════════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api-client';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface NotificationBellProps {
  onClick: () => void;
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function NotificationBell({ onClick }: NotificationBellProps) {
  const { data: unreadData } = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      if (res.success && res.data) return res.data.count;
      return 0;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const unreadCount = unreadData ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`relative active:scale-[0.95] transition-transform duration-200 ${hasUnread ? 'text-emerald-500' : ''}`}
      onClick={onClick}
      title="Notificações"
    >
      {/* Bell icon with optional ring animation */}
      <div className="relative">
        <Bell className="size-4" />
        {/* Pulse ring when unread */}
        {hasUnread && (
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500/30"
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>
      {/* Badge with pulsing animation */}
      {hasUnread && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.span>
      )}
    </Button>
  );
}
