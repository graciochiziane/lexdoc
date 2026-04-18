// ═══════════════════════════════════════════════════════════════
// LEXDOC — Indicador de força da palavra-passe
// Barra visual + lista de requisitos com animações
// ═══════════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface PasswordStrengthIndicatorProps {
  password: string;
}

// ─────────────────────────────────────────
// Níveis de força
// ─────────────────────────────────────────
interface StrengthLevel {
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
}

const STRENGTH_LEVELS: StrengthLevel[] = [
  { label: 'Fraco', color: 'bg-red-500', bgColor: 'bg-red-500', minScore: 0 },
  { label: 'Razoável', color: 'bg-orange-500', bgColor: 'bg-orange-500', minScore: 1 },
  { label: 'Bom', color: 'bg-yellow-500', bgColor: 'bg-yellow-500', minScore: 2 },
  { label: 'Forte', color: 'bg-emerald-500', bgColor: 'bg-emerald-500', minScore: 3 },
];

// ─────────────────────────────────────────
// Requisitos de validação
// ─────────────────────────────────────────
interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'Mínimo 8 caracteres', test: (pw) => pw.length >= 8 },
  { label: 'Letra maiúscula', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Letra minúscula', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Número', test: (pw) => /[0-9]/.test(pw) },
  { label: 'Carácter especial (@$!%*?&)', test: (pw) => /[@$!%*?&]/.test(pw) },
];

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  // Calcular pontuação
  const score = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    for (const req of REQUIREMENTS) {
      if (req.test(password)) s++;
    }
    // Bónus por comprimento
    if (password.length >= 12) s++;
    return s;
  }, [password]);

  // Determinar índice do nível
  const levelIndex = useMemo(() => {
    if (score <= 1) return 0; // Fraco
    if (score <= 2) return 1; // Razoável
    if (score <= 3) return 2; // Bom
    if (score <= 4) return 2; // Bom
    return 3; // Forte
  }, [score]);

  const currentLevel = STRENGTH_LEVELS[levelIndex];

  // Não renderizar se não houver texto
  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3"
    >
      {/* Barras de força */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {STRENGTH_LEVELS.map((level, i) => (
            <div
              key={level.label}
              className="h-1.5 flex-1 rounded-full bg-muted transition-colors duration-300"
            >
              <motion.div
                className={`h-full rounded-full ${i <= levelIndex ? level.color : ''}`}
                initial={{ width: '0%' }}
                animate={{ width: i <= levelIndex ? '100%' : '0%' }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              />
            </div>
          ))}
        </div>
        <p className={`text-xs font-medium ${currentLevel.color.replace('bg-', 'text-')}`}>
          {currentLevel.label}
        </p>
      </div>

      {/* Lista de requisitos */}
      <ul className="space-y-1">
        {REQUIREMENTS.map((req, i) => {
          const met = req.test(password);
          return (
            <motion.li
              key={req.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 text-xs"
            >
              {met ? (
                <Check className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={met ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>
                {req.label}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
