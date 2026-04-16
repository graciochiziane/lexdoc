// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Registo
// Layout dividido: painel de marca (40%) + formulário (60%)
// Mobile: apenas formulário em ecrã completo
// ═══════════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { Shield, FolderOpen, Sparkles } from 'lucide-react';
import { RegisterForm } from '@/components/auth/RegisterForm';

// ─────────────────────────────────────────
// Logo SVG inline
// ─────────────────────────────────────────
function LexDocLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="0"
        y="36"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontWeight="700"
        fontSize="36"
        fill="white"
      >
        lex
      </text>
      <text
        x="60"
        y="36"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontWeight="700"
        fontSize="36"
        fill="#10b981"
      >
        Doc
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────
// Lista de funcionalidades (mesma do login)
// ─────────────────────────────────────────
const FEATURES = [
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Criptografia avançada e controlo de acesso por papéis',
  },
  {
    icon: FolderOpen,
    title: 'Organização',
    description: 'Gestão inteligente de processos e documentos',
  },
  {
    icon: Sparkles,
    title: 'Inteligência Artificial',
    description: 'Assistente IA para análise e classificação automática',
  },
];

// ─────────────────────────────────────────
// Variações de animação
// ─────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
};

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function RegisterView() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Painel esquerdo — marca (oculto em mobile) */}
      <div className="hidden md:flex md:w-[40%] relative overflow-hidden bg-gradient-to-br from-[#0f0f1e] via-[#1a1a2e] to-[#16213e] flex-col justify-between p-8 lg:p-12">
        {/* Padrão decorativo de fundo */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.2) 0%, transparent 50%)',
            }}
          />
        </div>

        {/* Conteúdo superior */}
        <motion.div {...fadeIn} className="relative z-10 space-y-2">
          <LexDocLogo className="h-10 w-auto" />
        </motion.div>

        {/* Conteúdo central */}
        <motion.div
          {...staggerContainer}
          animate="animate"
          className="relative z-10 space-y-8"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
              Gestão Documental{' '}
              <span className="text-emerald-400">Jurídica</span>{' '}
              Inteligente
            </h1>
            <p className="mt-3 text-sm lg:text-base text-gray-400 leading-relaxed">
              Comece a gerir os seus documentos jurídicos com a plataforma mais avançada
              de Moçambique. Registo rápido e seguro.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                {...staggerItem}
                className="flex items-start gap-4"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <feature.icon className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{feature.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Rodapé do painel */}
        <motion.div {...fadeIn} className="relative z-10">
          <p className="text-xs text-gray-500">
            © 2026 LexDoc — Moçambique. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Cabeçalho mobile */}
        <div className="md:hidden flex items-center justify-center pt-8 pb-4">
          <LexDocLogo className="h-8 w-auto" />
        </div>

        {/* Conteúdo central */}
        <motion.main
          {...fadeIn}
          className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12"
        >
          <div className="w-full max-w-md space-y-8">
            {/* Título */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Criar conta</h2>
              <p className="text-sm text-muted-foreground">
                Registe o seu escritório e comece a utilizar o LexDoc
              </p>
            </div>

            {/* Formulário */}
            <RegisterForm />
          </div>
        </motion.main>

        {/* Rodapé mobile */}
        <footer className="md:hidden py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 LexDoc — Moçambique. Todos os direitos reservados.
          </p>
        </footer>
      </div>
    </div>
  );
}
