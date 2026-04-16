// ═══════════════════════════════════════════════════════════════
// LEXDOC — Barra de Pesquisa Global
// Command palette com Ctrl+K / Cmd+K, resultados agrupados
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

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function SearchBar({ onSelect }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
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

  const totalResults = results.reduce((sum, g) => sum + g.count, 0);

  return (
    <>
      {/* Botão/trigger da pesquisa */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-64 lg:w-80"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left truncate">
          Pesquisar...
        </span>
        <kbd className="hidden sm:inline-flex pointer-events-none items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          <Command className="size-2.5" />K
        </kbd>
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
        <CommandInput
          placeholder="Pesquisar processos, clientes, documentos, prazos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">A pesquisar...</span>
            </div>
          )}

          {!loading && hasSearched && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-4">
                <Search className="size-8 text-muted-foreground/40" />
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

          {!loading && !hasSearched && query.length < 2 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
                <Search className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Digite pelo menos 2 caracteres para pesquisar
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Pesquisa em processos, clientes, documentos e prazos
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
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
                <span>navegar</span>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] ml-2">↵</kbd>
                <span>seleccionar</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CommandDialog>
    </>
  );
}
