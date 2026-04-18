// ═══════════════════════════════════════════════════════════════
// LEXDOC — Página principal (client-side router)
// Renderiza vistas com base no estado — não usa Next.js routing
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useNavStore } from '@/stores/nav.store';
import { useAuth } from '@/hooks/useAuth';
import { LoginView } from '@/components/views/LoginView';
import { RegisterView } from '@/components/views/RegisterView';
import { DashboardView } from '@/components/views/DashboardView';
import { AcceptInvitationView } from '@/components/dashboard/AcceptInvitationView';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

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

  // Convite token: read directly from search params (no setState in effect)
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const resetToken = searchParams.get('token');

  // Dismissed token state (for after accept/cancel)
  const [dismissedToken, setDismissedToken] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Restaurar sessão ao montar
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Handle invitation success → go to dashboard
  const handleInviteSuccess = useCallback(() => {
    setDismissedToken(true);
    // Clear URL params
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handle invitation cancel
  const handleInviteCancel = useCallback(() => {
    setDismissedToken(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handle reset password success
  const handleResetSuccess = useCallback(() => {
    setResetSuccess(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Show accept invitation view if token present and not dismissed
  const activeToken = inviteToken && !dismissedToken ? inviteToken : null;

  // Show reset password view if token present and not authenticated
  const activeResetToken = resetToken && !isAuthenticated && !resetSuccess ? resetToken : null;

  if (activeToken && !isAuthenticated) {
    return (
      <AcceptInvitationView
        token={activeToken}
        onSuccess={handleInviteSuccess}
        onCancel={handleInviteCancel}
      />
    );
  }

  // Show reset password form if reset token in URL
  if (activeResetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-xl border shadow-lg overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
            <div className="p-6 sm:p-8">
              <ResetPasswordForm
                token={activeResetToken}
                onSuccess={handleResetSuccess}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
