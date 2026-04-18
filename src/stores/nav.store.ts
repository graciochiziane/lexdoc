// ═══════════════════════════════════════════════════════════════
// LEXDOC — Estado de navegação (Zustand)
// Navegação via estado — todas as vistas renderizadas em page.tsx
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
type ViewType = 'login' | 'register' | 'dashboard' | 'forgot-password';

interface NavState {
  currentView: ViewType;
  navigate: (view: ViewType) => void;
}

// ─────────────────────────────────────────
// Store
// ─────────────────────────────────────────
export const useNavStore = create<NavState>((set) => ({
  currentView: 'login',
  navigate: (view: ViewType) => {
    set({ currentView: view });
  },
}));
