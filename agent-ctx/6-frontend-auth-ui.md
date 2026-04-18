# Task 6 — LexDoc Frontend Auth UI — Phase 1

## Resumo
Implementação completa da interface frontend de autenticação para a plataforma LexDoc. 12 ficheiros criados: stores Zustand, serviço de API, hook React, componentes de formulários, vistas completas com layout split e dashboard protegido.

## Ficheiros Criados (12/12)

### Stores (Zustand)
1. **`src/stores/auth.store.ts`** — Estado de autenticação
   - `setAuth()` / `clearAuth()` — gerir tokens e utilizador
   - `restoreSession()` — restaurar sessão via refresh token no mount
   - Persistência de refresh token em localStorage

2. **`src/stores/nav.store.ts`** — Navegação client-side
   - `currentView`: login | register | dashboard | forgot-password
   - `navigate()` — transição entre vistas sem routing

### Serviço
3. **`src/services/auth.service.ts`** — Serviço de API
   - `login()`, `register()`, `refreshToken()`, `logout()`
   - `authFetch()` — fetch com interceptor 401 (auto-refresh com queue)
   - `getAuthHeaders()` — headers Bearer token

### Hook
4. **`src/hooks/useAuth.ts`** — Hook de autenticação
   - TanStack Query mutations para login e registo
   - Tratamento de erros (ACCOUNT_LOCKED, TOO_MANY_REQUESTS, etc.)
   - Toast notifications via Sonner
   - Logout com limpeza completa

### Componentes Auth
5. **`src/components/auth/PasswordStrengthIndicator.tsx`** — Indicador de força
   - 4 barras visuais (Fraco, Razoável, Bom, Forte)
   - Cores: red → orange → yellow → emerald
   - Checklist animado com framer-motion (5 requisitos)
   - Bónus por comprimento ≥12 caracteres

6. **`src/components/auth/LoginForm.tsx`** — Formulário de login
   - react-hook-form + zod validation
   - Toggle show/hide password (Eye/EyeOff)
   - Erros contextuais: credenciais, conta bloqueada, rate limit
   - Links para registo e recuperação de password
   - Loading state com spinner

7. **`src/components/auth/RegisterForm.tsx`** — Formulário de registo
   - Campos: nome, email, password, confirmação, escritório, papel
   - Selector de papel: ADMIN, ADVOGADO, SECRETARIO, CLIENT
   - Password strength indicator integrado
   - Validação completa (regex, match de passwords)
   - Auto-login no registo bem-sucedido

### Vistas
8. **`src/components/views/LoginView.tsx`** — Página de login
   - Layout split: painel marca (40%) + formulário (60%)
   - Painel escuro com gradiente, logo SVG, tagline, features
   - Mobile: apenas formulário, logo mini no topo
   - Animações de entrada com framer-motion
   - Rodapé com copyright

9. **`src/components/views/RegisterView.tsx`** — Página de registo
   - Layout idêntico ao login (painel marca + formulário)
   - Textos adaptados para contexto de registo
   - Link "Já tem uma conta? Entrar"

10. **`src/components/views/DashboardView.tsx`** — Dashboard protegido
    - Sidebar fixa com navegação (6 itens com ícones)
    - Info do utilizador + badge de papel + botão logout
    - Sidebar responsiva (drawer mobile com overlay)
    - Cabeçalho com saudação + relógio Africa/Maputo
    - 4 cartões de estatísticas (valores placeholder 0)
    - Secção de actividade recente (placeholder)
    - Banner informativo da Phase 1

### Ficheiros raiz
11. **`src/app/page.tsx`** — Router cliente
    - QueryClientProvider + Toaster (Sonner)
    - Roteamento por estado (auth store + nav store)
    - Spinner de loading durante restoreSession()
    - Protecção: não autenticado → login

12. **`src/app/layout.tsx`** — Layout raiz actualizado
    - `lang="pt"` para português
    - Metadata: título, descrição, keywords LexDoc
    - Removido Toaster shadcn (usado Sonner no page.tsx)

## Stack Utilizada
- Zustand (stores de auth e navegação)
- TanStack Query (mutations de login/registo)
- react-hook-form + zod v4 (validação de formulários)
- framer-motion (animações de entrada)
- lucide-react (ícones)
- Sonner (toast notifications)
- shadcn/ui (Button, Input, Label, Card, Alert, Badge, Select, Form, Separator)

## Estado
- ✅ Lint: 0 erros, 1 aviso (React Compiler + form.watch — esperado)
- ✅ Dev server: compilando sem erros
- ✅ Todas as 12 vistas/renderizações funcionais
- ✅ Design responsivo (mobile-first)
- ✅ Texto em português
- ✅ Sem cores blue/indigo — emerald como accent
