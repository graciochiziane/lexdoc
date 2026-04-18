// ═══════════════════════════════════════════════════════════════
// LEXDOC — Hook de autenticação
// Combina Zustand store + TanStack Query mutations
// ═══════════════════════════════════════════════════════════════

'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore, type User } from '@/stores/auth.store';
import { useNavStore } from '@/stores/nav.store';
import { authService } from '@/services/auth.service';

// ─────────────────────────────────────────
// Hook principal de autenticação
// ─────────────────────────────────────────
export function useAuth() {
  const { user, isAuthenticated, isLoading, setAuth, clearAuth, restoreSession } =
    useAuthStore();
  const navigate = useNavStore((s) => s.navigate);

  // ── Mutation de login ──
  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await authService.login(email, password);
      if (!response.success) {
        throw response;
      }
      return response;
    },
    onSuccess: (response) => {
      if (response.data) {
        const { access_token, refresh_token, user: userData } = response.data;
        setAuth(access_token, refresh_token, userData);
        toast.success('Sessão iniciada com sucesso!');
        navigate('dashboard');
      }
    },
    onError: (error: unknown) => {
      const err = error as { error?: { code?: string; message?: string } };
      const code = err.error?.code;
      const message = err.error?.message;

      if (code === 'ACCOUNT_LOCKED') {
        toast.error('Conta temporariamente bloqueada por segurança. Tente novamente em 15 minutos.');
      } else if (code === 'TOO_MANY_REQUESTS') {
        toast.error('Demasiadas tentativas. Aguarde antes de tentar novamente.');
      } else {
        toast.error(message ?? 'Email ou palavra-passe incorrectos.');
      }
    },
  });

  // ── Mutation de registo ──
  const registerMutation = useMutation({
    mutationFn: async (data: {
      full_name: string;
      email: string;
      password: string;
      firm_name: string;
      role?: string;
    }) => {
      const response = await authService.register(data);
      if (!response.success) {
        throw response;
      }
      return response;
    },
    onSuccess: (response) => {
      if (response.data) {
        const { access_token, refresh_token, user: userData } = response.data;
        setAuth(access_token, refresh_token, userData);
        toast.success('Conta criada com sucesso! Bem-vindo ao LexDoc.');
        navigate('dashboard');
      }
    },
    onError: (error: unknown) => {
      const err = error as { error?: { code?: string; message?: string; details?: string[] } };
      const message = err.error?.message;

      if (message) {
        toast.error(message);
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    },
  });

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      await authService.logout(refreshToken ?? undefined);
    } catch {
      // Ignorar erros de logout — sempre limpar estado local
    } finally {
      clearAuth();
      navigate('login');
      toast.info('Sessão terminada.');
    }
  }, [clearAuth, navigate]);

  return {
    // Estado
    user,
    isAuthenticated,
    isLoading,

    // Acções
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,

    // Estado das mutations
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error as unknown as {
      error?: { code?: string; message?: string };
    } | null,
    registerError: registerMutation.error as unknown as {
      error?: { code?: string; message?: string; details?: string[] };
    } | null,

    // Restaurar sessão
    restoreSession,
  };
}
