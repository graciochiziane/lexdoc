// ═══════════════════════════════════════════════════════════════
// LEXDOC — Diálogo de Atalhos de Teclado
// Mostra todos os atalhos disponíveis agrupados por categoria
// ═══════════════════════════════════════════════════════════════

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Keyboard } from 'lucide-react';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

// ─────────────────────────────────────────
// Componente para tecla estilizada (kbd)
// ─────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md px-1.5 py-0.5 text-xs font-mono bg-muted border border-border shadow-sm">
      {children}
    </kbd>
  );
}

// ─────────────────────────────────────────
// Componente para uma linha de atalho
// ─────────────────────────────────────────
function ShortcutRow({ shortcut }: { shortcut: ShortcutItem }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-muted-foreground/50">+</span>}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Mapa de abas por número
// ─────────────────────────────────────────
const TAB_SHORTCUTS: Array<{ num: number; label: string }> = [
  { num: 1, label: 'Painel' },
  { num: 2, label: 'Processos' },
  { num: 3, label: 'Documentos' },
  { num: 4, label: 'Clientes' },
  { num: 5, label: 'Prazos' },
  { num: 6, label: 'Calendário' },
  { num: 7, label: 'Utilizadores' },
  { num: 8, label: 'Convites' },
  { num: 9, label: 'Relatórios' },
];

// ─────────────────────────────────────────
// Grupos de atalhos
// ─────────────────────────────────────────
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegação',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Pesquisa Global' },
      ...TAB_SHORTCUTS.map((t) => ({
        keys: ['Ctrl', String(t.num)],
        description: t.label,
      })),
    ],
  },
  {
    title: 'Geral',
    shortcuts: [
      { keys: ['?'], description: 'Abrir atalhos de teclado' },
      { keys: ['Esc'], description: 'Fechar diálogos' },
      { keys: ['Ctrl', 'D'], description: 'Alternar modo escuro' },
    ],
  },
  {
    title: 'Acções Rápidas',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Novo processo' },
      { keys: ['Ctrl', '⇧', 'N'], description: 'Novo cliente' },
    ],
  },
];

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Cabeçalho com gradiente esmeralda */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Keyboard className="size-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg">
                  Atalhos de Teclado
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                  Navegue mais rápido pelo LexDoc
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo dos atalhos */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <Separator className="mb-4" />}
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((shortcut) => (
                  <ShortcutRow key={shortcut.description} shortcut={shortcut} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé com dica */}
        <div className="px-6 py-3 bg-muted/30 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Pressione <Kbd>?</Kbd> em qualquer lugar para abrir este diálogo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
