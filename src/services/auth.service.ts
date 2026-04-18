// ═══════════════════════════════════════════════════════════════
// LEXDOC — Serviço de autenticação (API)
// Fetch com interceptor de refresh de token
// ═══════════════════════════════════════════════════════════════

import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/stores/auth.store';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const API_BASE = '/api/v1/auth';

// ─────────────────────────────────────────
// Tipos de resposta
// ─────────────────────────────────────────
interface AuthResponse {
  success: boolean;
  data?: {
    access_token: string;
    refresh_token: string;
    user: User;
  };
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
}

// ─────────────────────────────────────────
// Headers com token Bearer
// ─────────────────────────────────────────
function getAuthHeaders(): HeadersInit {
  const { accessToken } = useAuthStore.getState();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

// ─────────────────────────────────────────
// Refresh de token — queue para evitar race conditions
// ─────────────────────────────────────────
let refreshPromise: Promise<AuthResponse> | null = null;

async function refreshAccessToken(): Promise<AuthResponse> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    useAuthStore.getState().clearAuth();
    return { success: false, error: { code: 'NO_TOKEN', message: 'Sem token de refresh.' } };
  }

  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data: AuthResponse = await response.json();

  if (data.success && data.data) {
    const { access_token, refresh_token, user } = data.data;
    useAuthStore.getState().setAuth(access_token, refresh_token, user);
  } else {
    useAuthStore.getState().clearAuth();
  }

  return data;
}

// ─────────────────────────────────────────
// Fetch com interceptor de 401
// ─────────────────────────────────────────
async function authFetch(
  url: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<AuthResponse> {
  const headers = withAuth ? getAuthHeaders() : { 'Content-Type': 'application/json' };
  const response = await fetch(url, { ...options, headers });
  const data: AuthResponse = await response.json();

  // Se 401 e tem refresh token, tentar refresh e repetir
  if (response.status === 401 && withAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshResult = await refreshPromise;
    if (refreshResult.success) {
      // Repetir pedido com novo token
      const newHeaders = getAuthHeaders();
      const retryResponse = await fetch(url, { ...options, headers: newHeaders });
      return await retryResponse.json() as AuthResponse;
    }
  }

  return data;
}

// ─────────────────────────────────────────
// Serviço de autenticação
// ─────────────────────────────────────────
export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    return authFetch(`${API_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (data: {
    full_name: string;
    email: string;
    password: string;
    firm_name: string;
    role?: string;
  }): Promise<AuthResponse> => {
    return authFetch(`${API_BASE}/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return await response.json() as AuthResponse;
  },

  logout: async (refreshToken?: string): Promise<AuthResponse> => {
    return authFetch(
      `${API_BASE}/logout`,
      {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      true,
    );
  },

  // Headers de autenticação para uso externo
  getAuthHeaders,
};
