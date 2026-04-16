// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Notas
// Componente reutilizável para anotações em processos, clientes e prazos
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MessageSquare,
  Loader2,
  Send,
  X,
  Check,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
import { notesApi, type NoteItem } from '@/lib/api-client';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface NotesPanelProps {
  entityType: 'process' | 'client' | 'deadline';
  entityId: string;
  onClose?: () => void;
}

// ─────────────────────────────────────────
// Formatação de tempo relativo (pt-MZ)
// ─────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────
// Skeleton de carregamento
// ─────────────────────────────────────────
function NotesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-3 w-20 mt-2" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state animado
// ─────────────────────────────────────────
function EmptyNotesState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-10 text-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-3"
      >
        <MessageSquare className="size-7 text-emerald-500" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">Sem notas</p>
      <p className="text-xs text-muted-foreground mt-1">
        Adicione a primeira nota para este item.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Stagger animation
// ─────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function NotesPanel({ entityType, entityId, onClose }: NotesPanelProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryKey = ['notes', entityType, entityId];

  // ── Query: listar notas ──
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => notesApi.list(entityType, entityId),
    staleTime: 15 * 1000,
  });

  const notes: NoteItem[] = data?.data ?? [];

  // ── Mutation: criar nota ──
  const createMutation = useMutation({
    mutationFn: notesApi.create,
    onSuccess: () => {
      toast.success('Nota adicionada!');
      queryClient.invalidateQueries({ queryKey });
      setContent('');
      setIsPinned(false);
    },
    onError: () => {
      toast.error('Erro ao adicionar nota.');
    },
  });

  // ── Mutation: actualizar nota ──
  const updateMutation = useMutation({
    mutationFn: ({ id, data: noteData }: { id: string; data: { content?: string; is_pinned?: boolean } }) =>
      notesApi.update(id, noteData),
    onSuccess: () => {
      toast.success('Nota actualizada!');
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditContent('');
    },
    onError: () => {
      toast.error('Erro ao actualizar nota.');
    },
  });

  // ── Mutation: eliminar nota ──
  const deleteMutation = useMutation({
    mutationFn: notesApi.remove,
    onSuccess: () => {
      toast.success('Nota eliminada.');
      queryClient.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao eliminar nota.');
    },
  });

  // ── Handlers ──
  const handleCreate = useCallback(() => {
    if (!content.trim()) {
      toast.error('Escreva algo na nota.');
      return;
    }
    createMutation.mutate({
      entity_type: entityType,
      entity_id: entityId,
      content: content.trim(),
      is_pinned: isPinned,
    });
  }, [content, isPinned, entityType, entityId, createMutation]);

  const handleEdit = useCallback((note: NoteItem) => {
    setEditingId(note.id);
    setEditContent(note.content);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editingId || !editContent.trim()) return;
    updateMutation.mutate({ id: editingId, data: { content: editContent.trim() } });
  }, [editingId, editContent, updateMutation]);

  const handleTogglePin = useCallback((note: NoteItem) => {
    updateMutation.mutate({ id: note.id, data: { is_pinned: !note.is_pinned } });
  }, [updateMutation]);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  }, [deleteId, deleteMutation]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold">Notas</h3>
          <Badge variant="outline" className="text-[10px] rounded-full shadow-sm">
            {notes.length}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Formulário de nova nota */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
        <Textarea
          placeholder="Escreva uma nota..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="text-sm resize-none"
          maxLength={5000}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="pin-note"
                checked={isPinned}
                onCheckedChange={(checked) => setIsPinned(!!checked)}
                className="size-4 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <label htmlFor="pin-note" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <Pin className="size-3" />
                Fixar
              </label>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {content.length}/5000
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createMutation.isPending || !content.trim()}
            className="h-7 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-sm active:scale-[0.98] transition-all"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            <span className="text-xs ml-1">Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Lista de notas */}
      {isLoading ? (
        <NotesSkeleton />
      ) : notes.length === 0 ? (
        <EmptyNotesState />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-2 max-h-[400px] overflow-y-auto pr-1"
        >
          {notes.map((note) => (
            <motion.div
              key={note.id}
              variants={staggerItem}
              className={`p-3 rounded-lg border transition-all hover:shadow-sm ${
                note.is_pinned
                  ? 'border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10'
                  : 'border-l-4 border-l-transparent'
              }`}
            >
              {editingId === note.id ? (
                /* Modo de edição */
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    maxLength={5000}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {editContent.length}/5000
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => { setEditingId(null); setEditContent(''); }}
                      >
                        <X className="size-3" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleEditSave}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Modo de visualização */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleTogglePin(note)}
                        title={note.is_pinned ? 'Desafixar' : 'Fixar'}
                      >
                        {note.is_pinned ? (
                          <PinOff className="size-3 text-emerald-600" />
                        ) : (
                          <Pin className="size-3 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleEdit(note)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        onClick={() => setDeleteId(note.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                    <span className="font-medium">
                      {note.user_name ?? 'Utilizador'}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-2.5" />
                      {formatRelativeTime(note.updated_at)}
                    </span>
                    {note.is_pinned && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200">
                        <Pin className="size-2 mr-0.5" />
                        Fixada
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Diálogo de confirmação de eliminação */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Nota</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar esta nota? Esta acção não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
