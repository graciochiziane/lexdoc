// ═══════════════════════════════════════════════════════════════
// LEXDOC — Botão de Ações Rápidas (FAB)
// Botão flutuante com speed dial para criação rápida
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Briefcase,
  Users,
  Calendar,
  FileText,
  X,
} from 'lucide-react';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type QuickAction = 'processos' | 'clientes' | 'prazos' | 'documentos';

interface QuickActionsFABProps {
  onAction: (action: QuickAction) => void;
}

// ─────────────────────────────────────────
// Itens de acção rápida
// ─────────────────────────────────────────
const QUICK_ACTIONS: Array<{
  id: QuickAction;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = [
  {
    id: 'processos',
    label: 'Novo Processo',
    icon: Briefcase,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60',
  },
  {
    id: 'clientes',
    label: 'Novo Cliente',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/40 hover:bg-cyan-200 dark:hover:bg-cyan-900/60',
  },
  {
    id: 'prazos',
    label: 'Novo Prazo',
    icon: Calendar,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60',
  },
  {
    id: 'documentos',
    label: 'Novo Documento',
    icon: FileText,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60',
  },
];

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function QuickActionsFAB({ onAction }: QuickActionsFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // ── Fechar ao clicar fora ──
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ── Fechar com Escape ──
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleAction = useCallback((action: QuickAction) => {
    setIsOpen(false);
    onAction(action);
  }, [onAction]);

  return (
    <div
      ref={fabRef}
      className="fixed bottom-6 right-6 z-50 print:hidden"
    >
      {/* Overlay (subtle, optional) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/10 z-[-1]"
          />
        )}
      </AnimatePresence>

      {/* Speed Dial Items */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col-reverse items-end gap-3">
            {QUICK_ACTIONS.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.05,
                  ease: 'easeOut',
                }}
                className="flex items-center gap-3 group"
              >
                {/* Label */}
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15, delay: index * 0.05 }}
                  className="bg-popover text-popover-foreground shadow-lg rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap border pointer-events-none"
                >
                  {action.label}
                </motion.span>

                {/* Action Button */}
                <button
                  onClick={() => handleAction(action.id)}
                  className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-[0.92] ${action.bg}`}
                  title={action.label}
                >
                  <action.icon className={`size-5 ${action.color}`} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl shadow-emerald-500/25 flex items-center justify-center transition-all duration-200 sm:w-14 sm:h-14 w-12 h-12"
        aria-label={isOpen ? 'Fechar ações rápidas' : 'Ações rápidas'}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <X className="size-6" />
          ) : (
            <Plus className="size-6" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
}
