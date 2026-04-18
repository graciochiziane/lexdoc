// ═══════════════════════════════════════════════════════════════
// LEXDOC — Guia de Onboarding
// Multi-step guide mostrado no primeiro acesso ao dashboard
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  LayoutDashboard,
  Menu,
  Search,
  Rocket,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const ONBOARDING_KEY = 'lexdoc_onboarding_complete';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ElementType;
  tip?: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Bem-vindo ao LexDoc!',
    description: 'A sua plataforma de gestão documental jurídica. Vamos mostrar-lhe as funcionalidades principais para começar a trabalhar com eficiência.',
    icon: Sparkles,
    tip: 'Pode voltar a este guia a qualquer momento nas configurações.',
  },
  {
    title: 'Painel de Controlo',
    description: 'Aqui encontra as suas estatísticas, gráficos de actividade, processos recentes e prazos próximos. É o seu centro de operações.',
    icon: LayoutDashboard,
    tip: 'Os cartões de estatísticas actualizam-se automaticamente.',
  },
  {
    title: 'Navegação',
    description: 'A barra lateral esquerda dá acesso a todas as secções: processos, clientes, documentos, prazos e calendário. Pode colapsá-la para mais espaço.',
    icon: Menu,
    tip: 'Use o ícone de seta no topo da sidebar para colapsar/expandir.',
  },
  {
    title: 'Pesquisa Global',
    description: 'Use a barra de pesquisa no cabeçalho ou o atalho Ctrl+K para encontrar rapidamente processos, clientes ou documentos.',
    icon: Search,
    tip: 'Os resultados são agrupados por tipo para fácil navegação.',
  },
  {
    title: 'Comece a trabalhar!',
    description: 'Crie o seu primeiro processo ou cliente usando o botão de acções rápidas no canto inferior direito. A equipa do LexDoc está consigo!',
    icon: Rocket,
    tip: 'Pode também usar os formulários em cada secção para criar registos.',
  },
];

// ─────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 20 },
};

const stepContentVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function OnboardingGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check localStorage flag
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let dashboard render first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleComplete() {
    setIsAnimating(true);
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimating(false);
    }, 300);
  }

  function handleDismiss() {
    setIsAnimating(true);
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimating(false);
    }, 300);
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="onboarding-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Card */}
          <motion.div
            key="onboarding-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, type: 'spring', bounce: 0.15 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div className="relative h-32 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '20px 20px',
                }} />
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                <div className="absolute -bottom-6 -left-10 w-24 h-24 bg-white/5 rounded-full" />

                {/* Step indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentStep
                            ? 'w-6 bg-white'
                            : i < currentStep
                              ? 'w-1.5 bg-white/60'
                              : 'w-1.5 bg-white/25'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/70 ml-1">
                    {currentStep + 1}/{STEPS.length}
                  </span>
                </div>

                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                  aria-label="Fechar guia"
                >
                  <X className="size-3.5 text-white" />
                </button>

                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    key={step.title}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                    className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
                  >
                    <StepIcon className="size-8 text-white" />
                  </motion.div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    variants={stepContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <h3 className="text-lg font-bold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    {step.tip && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                        <Sparkles className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          {step.tip}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div>
                    {!isFirstStep ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrev}
                        className="text-muted-foreground"
                        disabled={isAnimating}
                      >
                        <ChevronLeft className="size-3.5 mr-1" />
                        Anterior
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDismiss}
                        className="text-muted-foreground"
                        disabled={isAnimating}
                      >
                        Saltar
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={isAnimating}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 shadow-md active:scale-[0.98]"
                  >
                    {isLastStep ? (
                      <>
                        Começar!
                        <Rocket className="size-3.5 ml-1.5" />
                      </>
                    ) : (
                      <>
                        Próximo
                        <ChevronRight className="size-3.5 ml-1.5" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                    initial={false}
                    animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
