// ═══════════════════════════════════════════════════════════════
// LEXDOC — Hook de atalhos de teclado globais
// Regista listeners para atalhos quando autenticado
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth.store';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type DashboardTab =
  | 'painel'
  | 'processos'
  | 'documentos'
  | 'clientes'
  | 'prazos'
  | 'calendario'
  | 'utilizadores'
  | 'auditoria'
  | 'convites'
  | 'relatorios';

interface UseKeyboardShortcutsOptions {
  onOpenShortcutsDialog: () => void;
  onTabChange?: (tab: DashboardTab) => void;
}

// ─────────────────────────────────────────
// Mapa de número para aba (baseado na ordem NAV_ITEMS)
// ─────────────────────────────────────────
const TAB_MAP: Record<number, DashboardTab> = {
  1: 'painel',
  2: 'processos',
  3: 'documentos',
  4: 'clientes',
  5: 'prazos',
  6: 'calendario',
  7: 'utilizadores',
  8: 'convites',
  9: 'relatorios',
};

// ─────────────────────────────────────────
// Helper: verificar se o alvo é um campo de entrada
// ─────────────────────────────────────────
function isInputFocused(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (!target) return false;
  const tagName = target.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}

// ─────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────
export function useKeyboardShortcuts({
  onOpenShortcutsDialog,
  onTabChange,
}: UseKeyboardShortcutsOptions) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Só activar atalhos quando autenticado
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // ── ? → Abrir diálogo de atalhos ──
      if (e.key === '?' && !isMod && !isInputFocused(e)) {
        e.preventDefault();
        onOpenShortcutsDialog();
        return;
      }

      // ── Ctrl/Cmd + 1-9 → Navegar para aba ──
      if (isMod && e.key >= '1' && e.key <= '9' && !e.shiftKey && !e.altKey) {
        const tabIndex = parseInt(e.key, 10);
        const tab = TAB_MAP[tabIndex];
        if (tab && onTabChange) {
          e.preventDefault();
          onTabChange(tab);
        }
        return;
      }

      // ── Ctrl/Cmd + D → Alternar modo escuro ──
      if (isMod && e.key === 'd' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setTheme(theme === 'dark' ? 'light' : 'dark');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, onOpenShortcutsDialog, onTabChange, setTheme, theme]);
}
