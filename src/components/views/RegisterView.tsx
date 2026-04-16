// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Registo (Enhanced)
// Layout dividido: painel de marca (40%) + formulário (60%)
// Mobile: apenas formulário em ecrã completo
// ═══════════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  FolderOpen,
  Sparkles,
  Lock,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { RegisterForm } from '@/components/auth/RegisterForm';

// ─────────────────────────────────────────
// Logo Component
// ─────────────────────────────────────────
function LexDocLogo({ className, white = false }: { className?: string; white?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <div className="relative w-10 h-10 shield-pulse-glow">
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 2L4 10v10c0 9.6 6.8 18.6 16 20 9.2-1.4 16-10.4 16-20V10L20 2z"
            fill="url(#shield-gradient-reg)"
            opacity="0.9"
          />
          <line x1="15" y1="18" x2="25" y2="18" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20" y1="12" x2="20" y2="25" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 22 L16 18 L14 14" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M26 22 L24 18 L26 14" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <defs>
            <linearGradient id="shield-gradient-reg" x1="4" y1="2" x2="36" y2="32">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex items-baseline">
        <span className={`text-xl font-bold tracking-tight ${white ? 'text-white' : 'text-foreground'}`}>
          lex
        </span>
        <span className="text-xl font-bold tracking-tight text-emerald-500">
          Doc
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Trust Badges
// ─────────────────────────────────────────
const TRUST_BADGES = [
  { icon: Lock, label: 'Criptografia AES-256' },
  { icon: Shield, label: 'Conformidade LGPD' },
  { icon: Clock, label: '99.9% Uptime' },
];

// ─────────────────────────────────────────
// Features list
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
// Animation variants
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

// Form card entry animation
const formCardEntry = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

// ─────────────────────────────────────────
// Particle dots animation for left panel
// ─────────────────────────────────────────
function ParticleDots() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 8,
    duration: Math.random() * 6 + 8,
    opacity: Math.random() * 0.4 + 0.1,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-emerald-400"
          style={{
            left: p.left,
            bottom: '-4px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `lexdoc-particle-float ${p.duration}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Floating shapes (shared with login)
// ─────────────────────────────────────────
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute top-[15%] right-[15%] w-16 h-16 border border-emerald-500/20 rotate-45"
        style={{ animation: 'lexdoc-float-1 8s ease-in-out infinite' }}
      />
      <div
        className="absolute top-[40%] left-[10%] w-8 h-8 rounded-full bg-emerald-500/10"
        style={{ animation: 'lexdoc-float-2 6s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[25%] right-[10%] w-24 h-24 rounded-full border border-emerald-400/15"
        style={{ animation: 'lexdoc-float-3 10s ease-in-out infinite' }}
      />
      <div
        className="absolute top-[60%] right-[40%] w-3 h-3 rounded-full bg-emerald-500/30"
        style={{ animation: 'lexdoc-float-2 5s ease-in-out infinite reverse' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export function RegisterView() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Left Panel — Branding ── */}
      <div className="hidden md:flex md:w-[40%] relative overflow-hidden bg-gradient-to-br from-[#0f0f1e] via-[#1a1a2e] to-[#16213e] flex-col justify-between p-8 lg:p-12">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 opacity-30 animate-lexdoc-gradient-shift" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Particle dots animation */}
        <ParticleDots />

        <FloatingShapes />

        {/* Top — Logo */}
        <motion.div {...fadeIn} className="relative z-10">
          <LexDocLogo white />
        </motion.div>

        {/* Center content */}
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

          {/* Social proof — smooth entrance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-[#0f0f1e] flex items-center justify-center"
                >
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {String.fromCharCode(65 + i)}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <CheckCircle key={i} className="size-3 text-emerald-400 fill-emerald-400" />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="text-white font-semibold">Mais de 500 advogados</span>{' '}
                confiam no LexDoc
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom — Trust badges — smooth stagger entrance */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
          className="relative z-10 space-y-4"
        >
          <div className="flex items-center gap-4 flex-wrap">
            {TRUST_BADGES.map((badge, idx) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.8 + idx * 0.1 }}
                className="flex items-center gap-1.5 text-gray-500"
              >
                <div className="flex items-center justify-center size-6 rounded-md bg-emerald-500/10">
                  <badge.icon className="size-3 text-emerald-400/70" />
                </div>
                <span className="text-[11px]">{badge.label}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            © 2026 LexDoc — Moçambique. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>

      {/* ── Right Panel — Form ── */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-center pt-8 pb-4">
          <LexDocLogo />
        </div>

        {/* Main content */}
        <motion.main
          {...fadeIn}
          className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12"
        >
          <div className="w-full max-w-md space-y-8">
            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Criar conta</h2>
              <p className="text-sm text-muted-foreground">
                Registe o seu escritório e comece a utilizar o LexDoc
              </p>
            </div>

            {/* Form card with glassmorphism + gradient border */}
            <motion.div
              {...formCardEntry}
              className="relative rounded-2xl"
            >
              {/* Gradient border wrapper */}
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 opacity-80" />
              {/* Inner content — enhanced glassmorphism */}
              <div className="relative rounded-2xl overflow-hidden backdrop-blur-2xl bg-white/85 dark:bg-gray-900/85 border border-white/30 dark:border-white/10 shadow-2xl shadow-emerald-500/5 dark:shadow-emerald-500/10 noise-overlay">
                <div className="p-6 sm:p-8">
                  <RegisterForm />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.main>

        {/* Mobile footer */}
        <footer className="md:hidden py-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.label} className="flex items-center gap-1 text-muted-foreground">
                <badge.icon className="size-3" />
                <span className="text-[10px]">{badge.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 LexDoc — Moçambique. Todos os direitos reservados.
          </p>
        </footer>
      </div>

      {/* Keyframe styles */}
      <style jsx global>{`
        @keyframes lexdoc-float-1 {
          0%, 100% { transform: translateY(0) rotate(45deg); opacity: 0.6; }
          50% { transform: translateY(-15px) rotate(45deg); opacity: 1; }
        }
        @keyframes lexdoc-float-2 {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-20px); opacity: 0.9; }
        }
        @keyframes lexdoc-float-3 {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-10px) scale(1.05); opacity: 0.6; }
        }
        @keyframes lexdoc-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-lexdoc-gradient-shift {
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,78,59,0.15) 25%, rgba(22,33,62,0.1) 50%, rgba(16,185,129,0.12) 75%, rgba(6,78,59,0.08) 100%);
          background-size: 400% 400%;
        }
      `}</style>
    </div>
  );
}
