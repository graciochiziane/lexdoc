// ═══════════════════════════════════════════════════════════════
// LEXDOC — Botão de Ações Rápidas (FAB)
// Botão flutuante com speed dial para criação rápida
// Tooltips, backdrop blur, animações melhoradas, responsivo
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
  description: string;
}> = [
  {
    id: 'processos',
    label: 'Novo Processo',
    icon: Briefcase,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60',
    description: 'Criar novo processo jurídico',
  },
  {
    id: 'clientes',
    label: 'Novo Cliente',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/40 hover:bg-cyan-200 dark:hover:bg-cyan-900/60',
    description: 'Adicionar novo cliente',
  },
  {
    id: 'prazos',
    label: 'Novo Prazo',
    icon: Calendar,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60',
    description: 'Definir novo prazo',
  },
  {
    id: 'documentos',
    label: 'Novo Documento',
    icon: FileText,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60',
    description: 'Carregar novo documento',
  },
];

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function QuickActionsFAB({ onAction }: QuickActionsFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
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
      {/* Backdrop com blur */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[-1]"
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
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.6 }}
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 20,
                  delay: index * 0.06,
                }}
                className="flex items-center gap-3 group"
                onMouseEnter={() => setHoveredAction(action.id)}
                onMouseLeave={() => setHoveredAction(null)}
              >
                {/* Label — com tooltip e descrição em telas grandes */}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15, delay: index * 0.06 + 0.05 }}
                  className="bg-popover text-popover-foreground shadow-lg rounded-lg px-3 py-2 border pointer-events-none min-w-0"
                >
                  <p className="text-sm font-medium whitespace-nowrap">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground hidden sm:block whitespace-nowrap">
                    {action.description}
                  </p>
                </motion.div>

                {/* Action Button — ícone + label em telas grandes, só ícone em mobile */}
                <button
                  onClick={() => handleAction(action.id)}
                  className={`flex items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-[0.90] ${action.bg} ${
                    // Tamanho: icon-only em mobile, icon+label em desktop
                    hoveredAction === action.id
                      ? 'w-auto pl-3 pr-4 gap-2 h-12'
                      : 'w-12 h-12 sm:w-auto sm:pl-3 sm:pr-4 sm:gap-2 sm:h-12'
                  }`}
                  title={action.label}
                >
                  <action.icon className={`size-5 ${action.color} shrink-0`} />
                  {/* Label visível em telas md+ ou quando hovered */}
                  <AnimatePresence>
                    {(hoveredAction === action.id) && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-xs font-medium text-muted-foreground overflow-hidden whitespace-nowrap hidden sm:block"
                      >
                        {action.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/25 rotate-0'
            : 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25'
        }`}
        aria-label={isOpen ? 'Fechar ações rápidas' : 'Ações rápidas'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="size-6" />
            </motion.div>
          ) : (
            <motion.div
              key="plus"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Plus className="size-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Label do FAB — escondido em mobile */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute -top-8 right-0 bg-popover text-popover-foreground shadow-md rounded-md px-2.5 py-1 text-xs font-medium border whitespace-nowrap hidden sm:block"
          >
            Acções rápidas
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
