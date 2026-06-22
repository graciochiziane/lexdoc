# LexDoc — Worklog de Desenvolvimento

---

## Estado Actual (22 Jun 2026)

**Branch principal:** `main` (commit `e3f4b08`)
**Branch backup:** `backup/postgres-fix-working-2026-06-22` (commit `63620e7`)
**Hosting:** Vercel (lexdoc-blue.vercel.app)
**Database:** Supabase PostgreSQL (eu-west-3, PgBouncer port 6543)

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

---

## Variáveis de Ambiente Necessárias no Vercel

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | PgBouncer (porta 6543) |
| `DIRECT_URL` | Recomendada | Conexão directa (porta 5432) para migrations |
| `JWT_SECRET` | ✅ | Mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | ✅ | Mínimo 32 caracteres |
| `GEMINI_API_KEY` | Para IA | Google AI Studio |

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