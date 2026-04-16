# Task 2 — LexDoc Backend Auth System (Phase 1)

## Resumo
Implementação completa do sistema de autenticação backend para a plataforma LexDoc (SaaS de gestão documental jurídica para Moçambique).

## Ficheiros Criados (8/8)

### Bibliotecas
1. **`src/lib/auth.ts`** — Utilitários JWT e hashing de passwords
   - `hashPassword()` / `verifyPassword()` — bcrypt com 10 salt rounds
   - `generateAccessToken()` / `generateRefreshToken()` — geração de tokens JWT
   - `verifyAccessToken()` / `verifyRefreshToken()` — verificação segura (retorna null em caso de erro)
   - `hashToken()` — hash bcrypt para armazenamento de refresh tokens
   - Tipos exportados: `TokenPayload`

2. **`src/lib/audit.ts`** — Serviço de auditoria assíncrono (fire-and-forget)
   - `logAudit()` — regista eventos sem bloquear o fluxo principal
   - Mascaragem automática de campos PII (`[REDACTED]`)
   - Serialização JSON para SQLite
   - Nunca lança excepções — silencioso em caso de erro

3. **`src/lib/rate-limit.ts`** — Rate limiter em memória
   - `checkRateLimit(key, maxAttempts, windowMs)` — verificação com janela temporal
   - Limpeza automática de entradas expiradas a cada 60s
   - Retorna `{ allowed, retryAfterMs }`

4. **`src/lib/rbac.ts`** — Controlo de acesso RBAC
   - Hierarquia: ADMIN(4) > ADVOGADO(3) > SECRETARIO(2) > CLIENT(1)
   - `hasRole()` — verificação de papéis (ADMIN acesso total)
   - `canAccessResource()` — verificação de firm_id (isolamento multi-tenant)
   - `canManageRole()` — hierarquia para gestão de utilizadores
   - Tipos exportados: `VALID_ROLES`, `ValidRole`

### Endpoints API
5. **`POST /api/v1/auth/register`** — Registo de utilizador
   - Validação de email, password (regex forte), nome, escritório
   - Criação automática de Firm + User + tokens
   - Mensagens de erro genéricas (não vazar existência de email)
   - Resposta: 201 (sucesso), 400 (validação), 409 (conflito), 500 (interno)

6. **`POST /api/v1/auth/login`** — Login com bloqueio de conta
   - Rate limiting: 5 tentativas por 60s por IP
   - Bloqueio automático após 5 falhas (15 minutos)
   - Reset de contagem em login bem-sucedido
   - Erros sempre genéricos (nunca especificar qual credencial está errada)
   - Resposta: 200 (sucesso), 401 (inválido), 403 (bloqueado), 429 (rate limit)

7. **`POST /api/v1/auth/refresh`** — Rotação de tokens
   - Revoga token antigo e gera novo par
   - Verifica: não revogado, não expirado, utilizador activo
   - Hash de token para busca na base de dados
   - Resposta: 200 (novos tokens), 401 (token inválido/expirado)

8. **`POST /api/v1/auth/logout`** — Terminar sessão
   - Verifica access token (opcional — não falha se ausente)
   - Revoga refresh token se fornecido
   - Regista evento de auditoria
   - Resposta: 200 (sucesso)

## Regras de Segurança Cumpridas
- ✅ Nenhum PII retornado nas respostas
- ✅ Erros de autenticação sempre genéricos
- ✅ Tokens JWT com expiração (15m acesso, 7d refresh)
- ✅ Refresh tokens armazenados como hash (bcrypt)
- ✅ Rotação de tokens no refresh
- ✅ Rate limiting por IP no login
- ✅ Bloqueio de conta após 5 falhas consecutivas
- ✅ Auditoria de todas as operações (fire-and-forget)
- ✅ Mascaragem de PII nos logs de auditoria
- ✅ Isolamento multi-tenant por firm_id no RBAC
- ✅ Fuso horário: Africa/Maputo

## Estado
- ✅ Lint passa sem erros
- ✅ Dev server a compilar sem problemas
- ✅ Prisma schema existente (User, Firm, RefreshToken, AuditLog)
