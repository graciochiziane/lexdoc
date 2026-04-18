// ═══════════════════════════════════════════════════════════════
// LEXDOC — Estado de autenticação (Zustand)
// Persiste refresh token em localStorage
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { authService } from '@/services/auth.service';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  role: string;
  firm_id: string;
  full_name: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (
    accessToken: string,
    refreshToken: string,
    user: User,
  ) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  restoreSession: () => Promise<void>;
}

// ─────────────────────────────────────────
// Chave para localStorage
// ─────────────────────────────────────────
const REFRESH_TOKEN_KEY = 'lexdoc_refresh_token';

// ─────────────────────────────────────────
// Store
// ─────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: typeof window !== 'undefined'
    ? localStorage.getItem(REFRESH_TOKEN_KEY)
    : null,
  user: null,
  isAuthenticated: false,
  isLoading: true, // Começa true para verificar sessão

  setAuth: (accessToken: string, refreshToken: string, user: User) => {
    // Persistir refresh token
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  clearAuth: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  // Restaurar sessão ao iniciar — usar refresh token
  restoreSession: async () => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!stored) {
      set({ isLoading: false });
      return;
    }

    try {
      set({ isLoading: true });
      const response = await authService.refreshToken(stored);

      if (response.success && response.data) {
        const { access_token, refresh_token, user } = response.data;
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
        set({
          accessToken: access_token,
          refreshToken: refresh_token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Refresh token inválido — limpar
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      // Erro de rede ou outro — limpar estado
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
