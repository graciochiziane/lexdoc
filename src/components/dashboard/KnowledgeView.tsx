'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  BookOpen,
  Eye,
  Pin,
  Tag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scale,
  Landmark,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { knowledgeApi, type KnowledgeArticle } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  KnowledgeArticleDialog,
  CATEGORIES,
  CATEGORY_COLORS,
  getCategoryBadge,
  getCategoryLabel,
  parseTags,
} from './KnowledgeArticleDialog';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type DialogState = {
  open: boolean;
  mode: 'view' | 'create' | 'edit';
  article: KnowledgeArticle | null;
};

// ─────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function KnowledgeView() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'ADVOGADO';

  // State
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: 'view',
    article: null,
  });
  const limit = 12;

  // ── Fetch articles ──
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);

      const res = await knowledgeApi.list(params.toString());
      if (res.success && res.data) {
        setArticles(res.data);
        if (res.meta) {
          setTotalPages(res.meta.pages);
        }
      }
    } catch {
      toast.error('Erro ao carregar artigos.');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Reset page on search/category change
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  // ── Stats ──
  const [stats, setStats] = useState<{
    total_articles: number;
    total_views: number;
  } | null>(null);

  useEffect(() => {
    knowledgeApi
      .stats()
      .then((res) => {
        if (res.success && res.data) {
          setStats({
            total_articles: res.data.total_articles,
            total_views: res.data.total_views,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Open dialog ──
  const openCreate = () => {
    setDialog({ open: true, mode: 'create', article: null });
  };

  const openView = (article: KnowledgeArticle) => {
    setDialog({ open: true, mode: 'view', article });
  };

  const openEdit = (article: KnowledgeArticle) => {
    setDialog({ open: false, mode: 'view', article: null });
    // Small delay for smooth transition
    setTimeout(() => {
      setDialog({ open: true, mode: 'edit', article });
    }, 150);
  };

  const handleDelete = async (article: KnowledgeArticle) => {
    if (user?.role !== 'ADMIN') return;
    try {
      const res = await knowledgeApi.remove(article.id);
      if (res.success) {
        toast.success('Artigo eliminado com sucesso!');
        setDialog({ open: false, mode: 'view', article: null });
        fetchArticles();
      } else {
        toast.error('Erro ao eliminar artigo.');
      }
    } catch {
      toast.error('Erro ao eliminar artigo.');
    }
  };

  // ── Truncate content for card preview ──
  const truncateContent = (text: string, maxLen: number = 120) => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen).trim() + '...';
  };

  // ── Category gradient backgrounds for card headers ──
  const getCategoryGradient = (category: string) => {
    const gradients: Record<string, string> = {
      CONSTITUCIONAL: 'from-purple-600/80 to-purple-400/60',
      CIVIL: 'from-cyan-600/80 to-cyan-400/60',
      PENAL: 'from-red-600/80 to-red-400/60',
      COMERCIAL: 'from-amber-600/80 to-amber-400/60',
      TRABALHO: 'from-orange-600/80 to-orange-400/60',
      FAMILIA: 'from-pink-600/80 to-pink-400/60',
      FISCAL: 'from-emerald-600/80 to-emerald-400/60',
      ADMINISTRATIVO: 'from-indigo-600/80 to-indigo-400/60',
      PROCESSUAL: 'from-sky-600/80 to-sky-400/60',
      OUTRO: 'from-gray-600/80 to-gray-400/60',
    };
    return gradients[category] ?? gradients.OUTRO;
  };

  // ── Format date ──
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {stats && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-800/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <BookOpen className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total_articles}</p>
                <p className="text-xs text-muted-foreground">Total de Artigos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-200/50 dark:border-teal-800/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                <Eye className="size-5 text-teal-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total_views}</p>
                <p className="text-xs text-muted-foreground">Visualizações Totais</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-200/50 dark:border-purple-800/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <Scale className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{CATEGORIES.length}</p>
                <p className="text-xs text-muted-foreground">Categorias Jurídicas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filters + Create */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar artigos, leis, referências..."
            className="pl-9 bg-background"
          />
        </div>

        {/* Category filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Create button */}
        {canCreate && (
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-sm whitespace-nowrap"
          >
            <Plus className="size-4 mr-1.5" />
            Novo Artigo
          </Button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} variants={cardVariants}>
              <Card className="overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-400" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Article cards grid */}
      {!loading && articles.length > 0 && (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            key={`grid-${page}-${search}-${categoryFilter}`}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {articles.map((article) => {
              const tags = parseTags(article.tags);
              return (
                <motion.div key={article.id} variants={cardVariants}>
                  <Card
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200 group border-transparent hover:border-border"
                    onClick={() => openView(article)}
                  >
                    {/* Category gradient header */}
                    <div className={`h-2 bg-gradient-to-r ${getCategoryGradient(article.category)}`} />

                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {article.title}
                        </h3>
                        {article.is_pinned && (
                          <Pin className="size-3.5 text-amber-500 shrink-0 mt-0.5 fill-amber-500" />
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Category badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getCategoryBadge(article.category)}`}
                      >
                        {getCategoryLabel(article.category)}
                      </Badge>

                      {/* Content preview */}
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {truncateContent(article.content, 150)}
                      </p>

                      {/* Source */}
                      {article.source && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                          <Landmark className="size-3 shrink-0" />
                          <span className="truncate">{article.source}</span>
                        </p>
                      )}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground border"
                            >
                              {tag}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3" />
                            {article.view_count}
                          </span>
                          <span>{formatDate(article.created_at)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            openView(article);
                          }}
                        >
                          Ler mais
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="active:scale-[0.97]"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="active:scale-[0.97]"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [0, 2, -2, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative mb-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/30">
              <BookOpen className="size-10 text-emerald-500" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <Scale className="size-3 text-emerald-500" />
            </motion.div>
          </motion.div>

          <h3 className="text-lg font-semibold text-foreground mb-2">
            {search || categoryFilter !== 'ALL'
              ? 'Nenhum artigo encontrado'
              : 'Base de Conhecimento Vazia'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            {search || categoryFilter !== 'ALL'
              ? 'Tente ajustar os filtros ou pesquisar por outros termos.'
              : 'Comece a construir a base de conhecimento jurídica do seu escritório. Adicione legislação, artigos e documentos de referência.'}
          </p>

          {(search || categoryFilter !== 'ALL') ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
              }}
            >
              Limpar Filtros
            </Button>
          ) : canCreate ? (
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-sm"
            >
              <Plus className="size-4 mr-1.5" />
              Criar Primeiro Artigo
            </Button>
          ) : null}
        </motion.div>
      )}

      {/* Dialog */}
      <KnowledgeArticleDialog
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((prev) => ({ ...prev, open }));
        }}
        mode={dialog.mode}
        article={dialog.article}
        onSaved={fetchArticles}
        onEdit={openEdit}
        onDelete={() => {
          if (dialog.article) handleDelete(dialog.article);
        }}
      />
    </div>
  );
}
