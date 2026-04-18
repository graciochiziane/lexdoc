'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Eye,
  Calendar,
  Tag,
  Pin,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { knowledgeApi, type KnowledgeArticle } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
export const CATEGORIES = [
  { value: 'CONSTITUCIONAL', label: 'Constitucional' },
  { value: 'CIVIL', label: 'Civil' },
  { value: 'PENAL', label: 'Penal' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'TRABALHO', label: 'Trabalho' },
  { value: 'FAMILIA', label: 'Família' },
  { value: 'FISCAL', label: 'Fiscal' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'PROCESSUAL', label: 'Processual' },
  { value: 'OUTRO', label: 'Outro' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  CONSTITUCIONAL: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  CIVIL: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  PENAL: 'bg-red-500/15 text-red-400 border-red-500/25',
  COMERCIAL: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  TRABALHO: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  FAMILIA: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  FISCAL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  ADMINISTRATIVO: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  PROCESSUAL: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  OUTRO: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
};

export function getCategoryBadge(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OUTRO;
}

export function getCategoryLabel(category: string) {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.label ?? category;
}

export function parseTags(tagsStr: string): string[] {
  try {
    const parsed = JSON.parse(tagsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface KnowledgeArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'view' | 'create' | 'edit';
  article?: KnowledgeArticle | null;
  onSaved?: () => void;
  onEdit?: (article: KnowledgeArticle) => void;
  onDelete?: () => void;
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function KnowledgeArticleDialog({
  open,
  onOpenChange,
  mode,
  article,
  onSaved,
  onEdit,
  onDelete,
}: KnowledgeArticleDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('OUTRO');
  const [source, setSource] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'ADVOGADO';
  const canDelete = user?.role === 'ADMIN';

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setCategory('OUTRO');
    setSource('');
    setTagsInput('');
    setIsPinned(false);
    setErrors([]);
  }, []);

  // Populate form for edit mode
  useEffect(() => {
    if (open && mode === 'edit' && article) {
      setTitle(article.title);
      setContent(article.content);
      setCategory(article.category);
      setSource(article.source ?? '');
      setTagsInput(parseTags(article.tags).join(', '));
      setIsPinned(article.is_pinned);
      setErrors([]);
    }
    if (open && mode === 'create') {
      resetForm();
    }
  }, [open, mode, article, resetForm]);

  // ── Save handler ──
  const handleSave = async () => {
    const validationErrors: string[] = [];
    if (!title.trim() || title.trim().length < 2) {
      validationErrors.push('Título deve ter no mínimo 2 caracteres.');
    }
    if (!content.trim() || content.trim().length < 10) {
      validationErrors.push('Conteúdo deve ter no mínimo 10 caracteres.');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSaving(true);

    try {
      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const tagsJson = JSON.stringify(tagsArray);

      const data = {
        title: title.trim(),
        content: content.trim(),
        category,
        source: source.trim() || undefined,
        tags: tagsJson,
        is_pinned: isPinned,
      };

      let res;
      if (mode === 'create') {
        res = await knowledgeApi.create(data);
      } else if (mode === 'edit' && article?.id) {
        res = await knowledgeApi.update(article.id, data);
      } else {
        return;
      }

      if (res.success) {
        toast.success(mode === 'create' ? 'Artigo criado com sucesso!' : 'Artigo actualizado com sucesso!');
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(res.error?.message ?? 'Erro ao salvar artigo.');
        if (res.error?.details) {
          setErrors(res.error.details);
        }
      }
    } catch {
      toast.error('Erro ao salvar artigo.');
    } finally {
      setSaving(false);
    }
  };

  // ── Header gradient ──
  const getHeaderGradient = () => {
    switch (mode) {
      case 'create': return 'from-emerald-600 to-emerald-400';
      case 'edit': return 'from-teal-600 to-teal-400';
      case 'view': return 'from-emerald-600 to-teal-500';
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create': return 'Novo Artigo';
      case 'edit': return 'Editar Artigo';
      case 'view': return article?.title ?? 'Artigo';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Gradient header */}
        <div className={`bg-gradient-to-r ${getHeaderGradient()} px-6 py-5 shrink-0`}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2">
              <BookOpen className="size-5" />
              {getDialogTitle()}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {/* Loading state */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <Loader2 className="size-8 text-emerald-500 animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">A carregar artigo...</p>
              </motion.div>
            )}

            {/* View mode */}
            {!loading && mode === 'view' && article && (
              <motion.div
                key="view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-5"
              >
                {/* Category & Pin */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={getCategoryBadge(article.category)}>
                    {getCategoryLabel(article.category)}
                  </Badge>
                  {article.is_pinned && (
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/25">
                      <Pin className="size-3 mr-1" />
                      Fixado
                    </Badge>
                  )}
                </div>

                {/* Source */}
                {article.source && (
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">Referência:</span>
                    <span className="text-muted-foreground">{article.source}</span>
                  </div>
                )}

                {/* Content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {article.content}
                  </div>
                </div>

                {/* Tags */}
                {article.tags && parseTags(article.tags).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="size-4 text-muted-foreground shrink-0" />
                    {parseTags(article.tags).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" />
                    {article.view_count} visualização{article.view_count !== 1 ? 'ões' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(article.created_at).toLocaleDateString('pt-MZ', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    {article.created_by.full_name}
                  </span>
                </div>

                {/* Actions */}
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-2 pt-3">
                    {canEdit && (
                      <Button
                        onClick={() => onEdit?.(article)}
                        className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white"
                      >
                        Editar
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="destructive"
                        onClick={onDelete}
                        className="ml-auto"
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Create/Edit form */}
            {!loading && (mode === 'create' || mode === 'edit') && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-4"
              >
                {/* Validation errors */}
                <AnimatePresence>
                  {errors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 space-y-1"
                    >
                      {errors.map((err, idx) => (
                        <p key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {err}
                        </p>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Título <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Código Penal de Moçambique — Artigo 1"
                    className="bg-background"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Referência Legal
                  </label>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Ex: Lei nº 5/2019, Decreto 14/2008..."
                    className="bg-background"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tags</label>
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Separadas por vírgula: constituição, direitos, art. 1"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">Separe as tags por vírgula</p>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Conteúdo <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva o conteúdo do artigo..."
                    className="bg-background min-h-[200px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground">{content.length} caracteres (mínimo 10)</p>
                </div>

                {/* Pin toggle */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <button
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    className={`
                      w-10 h-6 rounded-full transition-colors relative shrink-0
                      ${isPinned ? 'bg-emerald-500' : 'bg-muted-foreground/30'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                        ${isPinned ? 'translate-x-5' : 'translate-x-1'}
                      `}
                    />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Pin className="size-3.5" />
                      Fixar artigo
                    </p>
                    <p className="text-xs text-muted-foreground">Artigos fixados aparecem no topo da lista</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className={`bg-gradient-to-r ${getHeaderGradient()} hover:opacity-90 text-white`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        A guardar...
                      </>
                    ) : mode === 'create' ? (
                      'Criar Artigo'
                    ) : (
                      'Guardar Alterações'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
