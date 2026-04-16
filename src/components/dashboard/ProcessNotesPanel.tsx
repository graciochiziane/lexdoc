// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Notas do Processo
// Notas cronológicas com avatar, timestamp e delete
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  Trash2,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { processNotesApi, type ProcessNoteRecord } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ProcessNotesPanelProps {
  processId: string;
  processNumber?: string;
}

export function ProcessNotesPanel({ processId, processNumber }: ProcessNotesPanelProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['process-notes', processId],
    queryFn: () => processNotesApi.list(processId),
    staleTime: 15 * 1000,
    enabled: !!processId,
  });

  const notes: ProcessNoteRecord[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: { content: string }) => processNotesApi.create(processId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-notes', processId] });
      setContent('');
      toast.success('Nota adicionada.');
    },
    onError: () => toast.error('Erro ao adicionar nota.'),
  });

  const handleSend = useCallback(() => {
    if (!content.trim()) return;
    createMutation.mutate({ content: content.trim() });
  }, [content, createMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const AVATAR_COLORS = [
    'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
    'bg-amber-500/20 text-amber-700 dark:text-amber-400',
    'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    'bg-red-500/20 text-red-700 dark:text-red-400',
    'bg-teal-500/20 text-teal-700 dark:text-teal-400',
  ];

  const getAvatarColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="size-4 text-emerald-500" />
          Notas do Processo
        </h3>
        {processNumber && (
          <span className="text-xs text-muted-foreground">{processNumber}</span>
        )}
      </div>

      {/* Notes list */}
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sem notas neste processo.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Adicione a primeira nota usando o campo abaixo.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notes.map((note) => {
              const isOwner = note.created_by === user?.id;
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group flex gap-3"
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(note.created_by)}`}
                    title={note.created_by_name}
                  >
                    {note.created_by_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{note.created_by_name}</span>
                        {isOwner && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="size-2.5 text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground" title={format(new Date(note.created_at), "dd/MM/yyyy HH:mm")}>
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: pt })}
                        </span>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                            onClick={() => {
                              // Note: Only visual for now, no delete API on ProcessNote yet
                              toast.info('Eliminação de notas será adicionada em breve.');
                            }}
                          >
                            <Trash2 className="size-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          placeholder="Escreva uma nota... (Ctrl+Enter para enviar)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none text-sm min-h-[60px]"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!content.trim() || createMutation.isPending}
          className="self-end shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white active:scale-[0.95]"
        >
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
