// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Login (Enhanced)
// Layout dividido: painel de marca (40%) + formulário (60%)
// Mobile: apenas formulário em ecrã completo
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  FolderOpen,
  Sparkles,
  Lock,
  Server,
  Clock,
  CheckCircle,
  Users,
} from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

// ─────────────────────────────────────────
// Logo Component — Emerald shield with LexDoc text
// ─────────────────────────────────────────
function LexDocLogo({ className, white = false }: { className?: string; white?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <div className="relative w-10 h-10">
        {/* Shield shape */}
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 2L4 10v10c0 9.6 6.8 18.6 16 20 9.2-1.4 16-10.4 16-20V10L20 2z"
            fill="url(#shield-gradient)"
            opacity="0.9"
          />
          {/* Scale icon inside shield */}
          <line x1="15" y1="18" x2="25" y2="18" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20" y1="12" x2="20" y2="25" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 22 L16 18 L14 14" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M26 22 L24 18 L26 14" stroke={white ? '#fff' : '#0f0f1e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <defs>
            <linearGradient id="shield-gradient" x1="4" y1="2" x2="36" y2="32">
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
// Animated floating shapes
// ─────────────────────────────────────────
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Shape 1 — floating diamond */}
      <div
        className="absolute top-[15%] right-[15%] w-16 h-16 border border-emerald-500/20 rotate-45"
        style={{
          animation: 'lexdoc-float-1 8s ease-in-out infinite',
        }}
      />
      {/* Shape 2 — small circle */}
      <div
        className="absolute top-[40%] left-[10%] w-8 h-8 rounded-full bg-emerald-500/10"
        style={{
          animation: 'lexdoc-float-2 6s ease-in-out infinite',
        }}
      />
      {/* Shape 3 — large ring */}
      <div
        className="absolute bottom-[25%] right-[10%] w-24 h-24 rounded-full border border-emerald-400/15"
        style={{
          animation: 'lexdoc-float-3 10s ease-in-out infinite',
        }}
      />
      {/* Shape 4 — small dot */}
      <div
        className="absolute top-[60%] right-[40%] w-3 h-3 rounded-full bg-emerald-500/30"
        style={{
          animation: 'lexdoc-float-2 5s ease-in-out infinite reverse',
        }}
      />
      {/* Shape 5 — cross */}
      <div
        className="absolute top-[25%] left-[40%] w-6 h-6"
        style={{
          animation: 'lexdoc-float-1 7s ease-in-out infinite reverse',
        }}
      >
        <div className="absolute inset-0 bg-emerald-500/15 rounded-full" />
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

// ─────────────────────────────────────────
// Time-based greeting
// ─────────────────────────────────────────
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export function LoginView() {
  const [greeting] = useState(getTimeGreeting);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Update greeting periodically (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      // Re-render could be done with state but we keep it simple
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for nav store changes to show forgot password
  useEffect(() => {
    // Import dynamically to avoid circular deps
    let unsub: (() => void) | undefined;
    (async () => {
      const { useNavStore } = await import('@/stores/nav.store');
      unsub = useNavStore.subscribe((state) => {
        if (state.currentView === 'forgot-password') {
          setShowForgotPassword(true);
        }
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Left Panel — Branding (hidden on mobile) ── */}
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

        {/* Floating 3D shapes */}
        <FloatingShapes />

        {/* Top content — Logo */}
        <motion.div {...fadeIn} className="relative z-10">
          <LexDocLogo white />
        </motion.div>

        {/* Center content — Features */}
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
              Plataforma completa para escritórios de advocacia em Moçambique.
              Organize, proteja e analise os seus documentos com eficiência.
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

          {/* Social proof */}
          <div className="flex items-center gap-3 pt-2">
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
          </div>
        </motion.div>

        {/* Bottom — Trust badges */}
        <motion.div {...fadeIn} className="relative z-10 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.label} className="flex items-center gap-1.5 text-gray-500">
                <badge.icon className="size-3.5" />
                <span className="text-[11px]">{badge.label}</span>
              </div>
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
          className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8"
        >
          <div className="w-full max-w-md space-y-8">
            {/* Title with time-based greeting */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {greeting} 👋
              </h2>
              <p className="text-sm text-muted-foreground">
                {!showForgotPassword
                  ? 'Bem-vindo de volta! Introduza as suas credenciais para aceder à plataforma'
                  : 'Recuperar acesso à sua conta'}
              </p>
            </div>

            {/* Form card with gradient top border */}
            <div className="rounded-xl border shadow-lg overflow-hidden">
              {/* Gradient top border */}
              <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />

              <div className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  {!showForgotPassword ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Google login (disabled placeholder) */}
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-muted-foreground cursor-not-allowed mb-4"
                      >
                        <svg className="size-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Entrar com Google
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                          Em breve
                        </span>
                      </button>

                      {/* Divider */}
                      <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-3 text-muted-foreground">ou</span>
                        </div>
                      </div>

                      {/* Email/password form */}
                      <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="forgot"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
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

      {/* Keyframe styles for floating animations */}
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
