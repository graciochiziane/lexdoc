# LexDoc — Worklog de Desenvolvimento

---

## Estado Actual (24 Jun 2026)

**Branch principal:** `main` (commit `2b29559`)
**Branch backup:** `backup/postgres-fix-working-2026-06-22` (commit `63620e7`)
**Hosting:** Vercel (lexdoc-blue.vercel.app)
**Database:** Supabase PostgreSQL (eu-west-3, PgBouncer port 6543)
**AI Provider:** Google Gemini 2.5 Flash (com fallback ZAI automático)
**Super Admin:** Implementado nesta sessão (bootstrap + painel de gestão)

---

## Modificações Realizadas

### Sessão 1 — Correcção Crítica do Vercel (commits 63620e7)
1. **`prisma/schema.prisma`** — Mudou `provider = "sqlite"` para `provider = "postgresql"`. Adicionou `directUrl` para migrations. Esta era a causa raiz do erro 500 no Vercel (cliente SQLite a tentar ligar a PostgreSQL).
2. **`src/lib/auth.ts`** — Moveu validação de `JWT_SECRET`/`JWT_REFRESH_SECRET` do module-level (throw no import) para funções lazy (`getJWTSecret()`, `getJWTRefreshSecret()`). Previne 500 em qualquer endpoint que importe auth.ts quando env vars faltam.
3. **`.env.example`** — Adicionou documentação para `DIRECT_URL`.

### Sessão 2 — Motor de IA Streaming (commit e3f4b08)
1. **`src/lib/llm.ts`** — Adicionou `streamLLM()` async generator (Gemini stream nativo, ZAI fallback chunk).
2. **`src/app/api/v1/ai/chat/stream/route.ts`** — Novo endpoint SSE com eventos `init`/`chunk`/`done`/`error`. Salva mensagem completa e auditoria fire-and-forget.
3. **`src/lib/api-client.ts`** — Adicionou `aiApi.chatStream()` async generator que consome SSE via `ReadableStream`.
4. **`src/components/dashboard/AIChatPanel.tsx`** — Reescrito para streaming: cursor piscante, botão de parar, transição typing→stream.
5. **`src/components/dashboard/AIHubView.tsx`** — Chat tab actualizado para streaming com cursor animado.
6. **`src/app/api/v1/ai/extract-deadlines/route.ts`** — Bug fix: adicionado `firm_id` em falta no `db.deadline.create`.

### Sessão 3 — Integração Gemini API Key + Fallback (commit 2b29559)
1. **`src/lib/gemini.ts`** — Actualizado modelo padrão de `gemini-2.5-flash-preview-05-20` (deprecated) para `gemini-2.5-flash`.
2. **`src/lib/llm.ts`** — Adicionado fallback automático Gemini→ZAI em `streamLLM()` e `chatWithLLM()`. Se Gemini falhar (geofencing, quota, modelo), tenta ZAI antes de reportar erro.
3. **`.env.example`** — Actualizado `GEMINI_MODEL` para `gemini-2.5-flash`.

**Testes realizados (curl):**
- ✅ Registro e login via API
- ✅ AI streaming: `init` → `chunk` → `done` (SSE)
- ✅ Fallback ZAI funcional quando Gemini indisponível
- ⚠️ Gemini não testável no sandbox (geofencing — "User location is not supported")

---

## Variáveis de Ambiente Necessárias no Vercel

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | PgBouncer (porta 6543) |
| `DIRECT_URL` | Recomendada | Conexão directa (porta 5432) para migrations |
| `JWT_SECRET` | ✅ | Mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | ✅ | Mínimo 32 caracteres |
| `GEMINI_API_KEY` | ✅ Para IA | Google AI Studio — `AIzaSy...` |
| `GEMINI_MODEL` | Opcional | Padrão: `gemini-2.5-flash` |

---

## Arquitectura do Motor de IA

```
Frontend (AIChatPanel / AIHubView)
  ↓ aiApi.chatStream() — async generator SSE
POST /api/v1/ai/chat/stream
  ↓ authenticateRequest → rate limit → validate
  ↓ searchKnowledgeArticles (RAG)
  ↓ buildLexAssistPromptWithRAG (V2.0 Governance)
  ↓ streamLLM()
    ├─ Gemini: streamGemini() — native streaming
    │   └─ Se falhar → fallback ZAI automático
    └─ ZAI: fallback — single chunk
  ↓ SSE events: init → chunk* → done
  ↓ fire-and-forget: db.aIMessage.create + logAudit
```

---

## Riscos e Recomendações

1. **Vercel env vars** — O deploy só funciona se `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` estiverem configurados no painel Vercel.
2. **`#` na password Supabase** — Deve ser URL-encoded como `%23` na `DATABASE_URL`.
3. **RAG vazio** — A base de conhecimento está vazia por defeito. O LexAssistent funciona mas com disclaimer de "conhecimento geral".
4. **Rate limiting em memória** — No Vercel serverless, o rate limiter reinicia a cada cold start. Funcional mas não persistente.

### Sessão 4 — Super Admin + Plataforma (24 Jun 2026)

**Problema identificado:** O role `SUPER_ADMIN` existia no RBAC mas era um "fantasma" — sem path de criação, sem rotas próprias, excluído dos checks de permissão, sem UI.

**Arquivos criados (7):**

1. **`src/app/api/v1/platform/bootstrap/route.ts`** — Endpoint `POST /api/v1/platform/bootstrap`. Permite que um ADMIN se promova a SUPER_ADMIN (só funciona se nenhum SUPER_ADMIN existir — one-time bootstrap). Retorna 409 se já existir um.

2. **`src/app/api/v1/platform/stats/route.ts`** — `GET /api/v1/platform/stats`. Estatísticas globais: firms, users, clients, processes, documents, deadlines, AI usage, distribuição por role e plano, utilizadores/escritórios recentes.

3. **`src/app/api/v1/platform/firms/route.ts`** — `GET /api/v1/platform/firms`. Lista todos os escritórios com filtros (search, plan, active) e paginação. Inclui `_count` de users, clients, processes, documents, ai_conversations.

4. **`src/app/api/v1/platform/firms/[id]/route.ts`** — `GET/PATCH/DELETE` para gestão individual de escritório. PATCH altera name/nif/plan/active. DELETE desactiva firm + todos os seus users (soft delete, transaccional).

5. **`src/app/api/v1/platform/users/route.ts`** — `GET /api/v1/platform/users`. Lista todos os utilizadores cross-firm com filtros (search, role, firm_id, active).

6. **`src/app/api/v1/platform/users/[id]/route.ts`** — `GET/PATCH` para gestão individual. Permite alterar role e is_active. Impede auto-modificação. Usa `canManageRole()` para validar hierarquia.

7. **`src/components/dashboard/PlatformAdminPanel.tsx`** — Painel completo de gestão da plataforma com 3 sub-tabs: Visão Geral (8 stat cards + distribuições + recentes), Escritórios (search, expand/collapse, deactivate), Utilizadores (search, filter por role, alterar papel, activar/desactivar). Inclui banner de bootstrap para ADMIN se promover.

**Arquivos modificados (5):**

1. **`src/lib/api-client.ts`** — Adicionado `platformApi` com 7 métodos: `bootstrap()`, `stats()`, `listFirms()`, `getFirm()`, `deactivateFirm()`, `listUsers()`, `updateUser()`. Tipos `PlatformStats`, `PlatformFirm`, `PlatformUser` adicionados.

2. **`src/app/api/v1/firm/settings/route.ts`** — Corrigido: `payload.role !== 'ADMIN'` → `!hasRole(payload.role, ['ADMIN'])`. Agora SUPER_ADMIN pode editar configurações do escritório.

3. **`src/app/api/v1/invitations/route.ts`** — Corrigido: POST e GET agora usam `hasRole()` em vez de `!== 'ADMIN'`. SUPER_ADMIN pode criar e listar convites.

4. **`src/app/api/v1/invitations/[token]/route.ts`** — Corrigido: DELETE (revogar convite) agora usa `hasRole()`.

5. **`src/app/api/v1/users/[id]/deactivate/route.ts`** — Corrigido: Agora usa `hasRole()`. SUPER_ADMIN pode desactivar utilizadores.

6. **`src/components/views/DashboardView.tsx`** — Adicionado: tipo `plataforma` ao DashboardTab, ícone `Globe` importado, item de navegação "Gestão da Plataforma" (roles: SUPER_ADMIN), rótulo no TAB_LABELS, case no renderContent, import do PlatformAdminPanel. Adicionado `SUPER_ADMIN` aos roles arrays de Convites, Relatórios e Auditoria.

**Bugs corrigidos:**
- ✅ `firm/settings` PATCH: SUPER_ADMIN estava excluído
- ✅ `invitations` POST/GET: SUPER_ADMIN estava excluído
- ✅ `invitations/[token]` DELETE: SUPER_ADMIN estava excluído
- ✅ `users/[id]/deactivate` PATCH: SUPER_ADMIN estava excluído
- ✅ Navegação: Convites, Relatórios e Auditoria invisíveis para SUPER_ADMIN

**Verificação:**
- ✅ `bun run lint` — 0 erros (1 warning pré-existente, não relacionado)
- ⚠️ Browser verification não possível (restrição de rede no sandbox)

---

## Como usar o Super Admin

### Promoção (first-time):
1. Login como ADMIN (Grácio)
2. Ir a **"Gestão da Plataforma"** na sidebar
3. Clicar **"Promover Conta"**
4. A página recarrega automaticamente com o novo role

### Gestão da Plataforma (após promoção):
1. A tab **"Gestão da Plataforma"** aparece com 3 sub-tabs
2. **Visão Geral** — estatísticas globais, distribuições, recentes
3. **Escritórios** — listar, pesquisar, ver detalhes, desactivar
4. **Utilizadores** — listar, pesquisar, filtrar por role, alterar papel, activar/desactivar