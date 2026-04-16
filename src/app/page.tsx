// ═══════════════════════════════════════════════════════════════
// LEXDOC — Página principal (client-side router)
// Renderiza vistas com base no estado — não usa Next.js routing
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useNavStore } from '@/stores/nav.store';
import { useAuthStore } from '@/stores/auth.store';
import { useAuth } from '@/hooks/useAuth';
import { LoginView } from '@/components/views/LoginView';
import { RegisterView } from '@/components/views/RegisterView';
import { DashboardView } from '@/components/views/DashboardView';

// ─────────────────────────────────────────
// QueryClient estático para evitar recriação
// ─────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minuto
      retry: 1,
    },
  },
});

// ─────────────────────────────────────────
// Componente de roteamento interno
// ═══════════════════════════════════════════════════════════════
function AppRouter() {
  const currentView = useNavStore((s) => s.currentView);
  const { isAuthenticated, isLoading, restoreSession } = useAuth();

  // Restaurar sessão ao montar
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Estado de carregamento inicial
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  // Utilizador autenticado → dashboard
  if (isAuthenticated) {
    return <DashboardView />;
  }

  // Não autenticado → mostrar vista com base no estado
  switch (currentView) {
    case 'register':
      return <RegisterView />;
    case 'forgot-password':
      // Phase 1 — mostrar login com mensagem futura
      return <LoginView />;
    case 'dashboard':
      // Não autenticado mas tenta aceder ao dashboard → redirecionar para login
      return <LoginView />;
    default:
      return <LoginView />;
  }
}

// ─────────────────────────────────────────
// Página principal
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
