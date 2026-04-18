// ═══════════════════════════════════════════════════════════════
// LEXDOC — Barra de Pesquisa Global
// Command palette com Ctrl+K / Cmd+K, resultados agrupados
// Pesquisas recentes em localStorage
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Briefcase,
  Users,
  FileText,
  Calendar,
  Loader2,
  Command,
  Clock,
  X,
  Trash2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { searchApi, type SearchGroup } from '@/lib/api-client';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface SearchBarProps {
  onSelect?: (type: string, id: string) => void;
  compact?: boolean;
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

// Ícones por tipo de resultado
const TYPE_ICONS: Record<string, React.ElementType> = {
  processes: Briefcase,
  clients: Users,
  documents: FileText,
  deadlines: Calendar,
};

// Mapeamento de tipo para tab do dashboard
const TYPE_TO_TAB: Record<string, string> = {
  processes: 'processos',
  clients: 'clientes',
  documents: 'documentos',
  deadlines: 'prazos',
};

// Cor do badge por tipo
const TYPE_COLORS: Record<string, string> = {
  processes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  clients: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  documents: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  deadlines: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const RECENT_SEARCHES_KEY = 'lexdoc_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// ─────────────────────────────────────────
// Funções auxiliares para pesquisas recentes
// ─────────────────────────────────────────
function getRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(searches: RecentSearch[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Silencioso
  }
}

function addRecentSearch(query: string) {
  if (!query || query.length < 2) return;
  const searches = getRecentSearches();
  const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase());
  filtered.unshift({ query, timestamp: Date.now() });
  saveRecentSearches(filtered.slice(0, MAX_RECENT_SEARCHES));
}

function clearRecentSearches() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  return new Date(timestamp).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function SearchBar({ onSelect, compact = false }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keyboard shortcut Ctrl+K / Cmd+K ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Carregar pesquisas recentes ao abrir ──
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  // ── Pesquisa com debounce ──
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      const response = await searchApi.global(`q=${encodeURIComponent(searchQuery)}&type=all&limit=5`);
      if (response.success && response.data) {
        setResults(response.data.results);
        addRecentSearch(searchQuery);
        setRecentSearches(getRecentSearches());
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // ── Handler de selecção ──
  const handleSelect = useCallback(
    (type: string, id: string) => {
      setOpen(false);
      setQuery('');
      setResults([]);
      setHasSearched(false);
      onSelect?.(type, id);
    },
    [onSelect],
  );

  // ── Re-run pesquisa recente ──
  const handleRecentSearchClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, []);

  // ── Limpar pesquisas recentes ──
  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const totalResults = results.reduce((sum, g) => sum + g.count, 0);

  const showRecentSearches = !loading && !hasSearched && query.length < 2 && recentSearches.length > 0;

  return (
    <>
      {/* Botão/trigger da pesquisa */}
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? 'flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200'
          : 'flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.1)] w-full sm:w-64 lg:w-80'
        }
        aria-label="Pesquisar"
      >
        <Search className="size-4 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 text-left truncate">
              Pesquisar...
            </span>
            <kbd className="hidden sm:inline-flex pointer-events-none items-center gap-0.5 rounded-md border border-border bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm tracking-wide">
              <Command className="size-2.5" />K
            </kbd>
          </>
        )}
      </button>

      {/* Dialog de pesquisa */}
      <CommandDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setQuery('');
            setResults([]);
            setHasSearched(false);
          }
        }}
        title="Pesquisa Global"
        description="Pesquisar processos, clientes, documentos e prazos"
      >
        <div className="relative">
          <CommandInput
            placeholder="Pesquisar em processos, clientes, documentos, prazos..."
            value={query}
            onValueChange={setQuery}
          />
          {!query && (
            <motion.span
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hidden sm:block"
            >
              Pesquisar em...
            </motion.span>
          )}
        </div>
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-emerald-500" />
              <span className="ml-2 text-sm text-muted-foreground">A pesquisar...</span>
            </div>
          )}

          {!loading && hasSearched && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Search className="size-8 text-muted-foreground/40" />
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Nenhum resultado encontrado para &quot;{query}&quot;
                </p>
              </div>
            </CommandEmpty>
          )}

          {!loading &&
            results.map((group, groupIndex) => {
              if (group.items.length === 0) return null;
              const Icon = TYPE_ICONS[group.type] ?? Search;

              return (
                <div key={group.type}>
                  {groupIndex > 0 && <CommandSeparator />}
                  <CommandGroup heading={`${group.label} (${group.count})`}>
                    {group.items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle ?? ''}`}
                        onSelect={() => handleSelect(item.type, item.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                            <Icon className="size-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[group.type] ?? ''}`}
                          >
                            {group.label}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}

          {/* Pesquisas recentes */}
          {showRecentSearches && (
            <div className="py-2">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Pesquisas recentes
                </span>
                <button
                  onClick={handleClearRecentSearches}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors active:scale-[0.98]"
                >
                  <Trash2 className="size-3" />
                  Limpar
                </button>
              </div>
              <CommandGroup>
                {recentSearches.map((recent, idx) => (
                  <CommandItem
                    key={`${recent.query}-${idx}`}
                    value={recent.query}
                    onSelect={() => handleRecentSearchClick(recent.query)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
                        <Clock className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{recent.query}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(recent.timestamp)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          )}

          {!loading && !hasSearched && query.length < 2 && recentSearches.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="size-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/40 flex items-center justify-center"
              >
                <Search className="size-6 text-emerald-500/60" />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Pesquisa rápida em todo o escritório
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Comece a digitar para pesquisar processos, clientes, documentos e prazos
                </p>
              </div>
            </div>
          )}
        </CommandList>

        {/* Rodapé com contagem */}
        <AnimatePresence>
          {totalResults > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between"
            >
              <span>{totalResults} resultado{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] tracking-wide">↑↓</kbd>
                <span>navegar</span>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] tracking-wide ml-2">↵</kbd>
                <span>seleccionar</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CommandDialog>
    </>
  );
}
