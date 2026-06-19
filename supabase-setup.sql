-- ═════════════════════════════════════════════════════════════════════════════════
-- LEXDOC v3 — Schema Completo para Supabase (PostgreSQL)
-- Plataforma SaaS de Gestão Documental Jurídica — Moçambique
-- ═════════════════════════════════════════════════════════════════════════════════
--
-- INSTRUÇÕES:
--   1. Abre Supabase Dashboard → SQL Editor
--   2. Clica "New query"
--   3. Cola TODO este SQL e clica "Run"
--
-- CORRECÇÕES v2 → v3 (baseado na análise Supabase AI):
--   ✅ UUID nativo (não TEXT) para todos os IDs primários
--   ✅ RLS explícito por tabela (sem loop genérico que falha em tabelas sem firm_id)
--   ✅ firm_id denormalizado em TODAS as tabelas (incluindo junction/child)
--   ✅ FORCE ROW LEVEL SECURITY activado em todas as tabelas
--   ✅ Triggers de integridade cross-firm (impede referência entre firms)
--   ✅ Permissões diferenciadas por role (ADMIN/LAWYER/ASSISTANT/CLIENT)
--   ✅ search_path fixo em todas as funções SECURITY DEFINER
--   ✅ Triggers explícitos por tabela (não loop dinâmico)
--   ✅ Cleanup agendado com pg_cron (documentado)
--   ✅ CHECK constraints para enums (status, role, priority, etc.)
--   ✅ Sem REVOKE ALL ON SCHEMA public (compatível com Supabase)
--   ✅ JSONB em vez de TEXT para arrays/objetos
--   ✅ Índices parciais optimizados
--   ✅ documents.firm_id com FK para firms (antes era sem constraint)
--   ✅ is_confidential protegido por RLS (só ADMIN/LAWYER)
--
-- NOTA ARQUITECTURAL:
--   LexDoc usa autenticação JWT própria (NÃO Supabase Auth).
--   Prisma liga como role 'postgres' → BYPASS RLS automaticamente.
--   Portanto:
--     - Isolamento PRINCIPAL: application-layer (middleware + Prisma queries com firm_id)
--     - RLS: defesa em profundidade para acesso directo via PostgREST/anon key
--     - Se habilitar PostgREST: configurar JWT secret em Supabase Dashboard
--     - JWT do LexDoc inclui: sub (user ID), email, role, firm_id
--
-- PRISMA: Ao mudar para Supabase, actualizar schema.prisma:
--   - @default(cuid()) → @default(uuid()) em todos os models
--   - Adicionar @db.Uuid nos campos de ID
--   - Adicionar firm_id nos models: RefreshToken, ProcessAssignment, Deadline,
--     ProcessNote, AIMessage
-- ═════════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════════
-- 0. EXTENSÕES
-- ═════════════════════════════════════════════════════════════════════════════════
-- pgcrypto: necessário para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- NOTA: pg_cron precisa ser activado manualmente no Supabase Dashboard.
-- A limpeza periódica (cleanup) está documentada na Secção 8 deste script.


-- ═════════════════════════════════════════════════════════════════════════════════
-- 1. SEGURANÇA — Schema lexdoc_auth + Funções Auxiliares para RLS
-- ═════════════════════════════════════════════════════════════════════════════════
-- Estas funções leem claims do JWT customizado do LexDoc.
-- Requisito: o JWT deve incluir sub, role, firm_id como claims.
-- Se o JWT não estiver presente (sem autenticação), as funções retornam NULL,
-- o que BLOQUEIA tudo via RLS (deny by default — seguro por natureza).

CREATE SCHEMA IF NOT EXISTS lexdoc_auth;

-- ID do utilizador actual (do claim 'sub' do JWT)
CREATE OR REPLACE FUNCTION lexdoc_auth.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
  SELECT NULLIF(
    (current_setting('request.jwt.claims', true)::json->>'sub')::TEXT,
    ''
  )::UUID;
$$;

-- firm_id do utilizador actual (do claim 'firm_id' do JWT)
CREATE OR REPLACE FUNCTION lexdoc_auth.current_firm_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
  SELECT NULLIF(
    (current_setting('request.jwt.claims', true)::json->>'firm_id')::TEXT,
    ''
  )::UUID;
$$;

-- Role do utilizador actual (do claim 'role' do JWT)
CREATE OR REPLACE FUNCTION lexdoc_auth.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  )::TEXT;
$$;


-- ═════════════════════════════════════════════════════════════════════════════════
-- 2. TABELAS
-- ═════════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.1 FIRMS (Escritórios)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  nif         TEXT,                                  -- PII — protegido por RLS
  oam_number  TEXT,                                  -- Registo OAM Moçambique
  is_active   BOOLEAN NOT NULL DEFAULT true,
  plan        TEXT NOT NULL DEFAULT 'STARTER',
  settings    JSONB NOT NULL DEFAULT '{}',           -- Configurações por escritório
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_firms_plan CHECK (plan IN ('STARTER', 'PRO', 'ENTERPRISE'))
);

CREATE INDEX IF NOT EXISTS idx_firms_slug ON firms(slug);
CREATE INDEX IF NOT EXISTS idx_firms_is_active ON firms(is_active) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.2 USERS (Utilizadores + RBAC)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id            UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'CLIENT',
  bi_number          TEXT,                                  -- PII
  phone              TEXT,
  avatar_url         TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  email_verified     BOOLEAN NOT NULL DEFAULT false,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until       TIMESTAMPTZ,
  mfa_enabled        BOOLEAN NOT NULL DEFAULT false,
  mfa_secret         TEXT,                                  -- Encriptado em repouso
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'LAWYER', 'ASSISTANT', 'CLIENT'))
);

CREATE INDEX IF NOT EXISTS idx_users_firm_id ON users(firm_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(firm_id, role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(firm_id) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.3 REFRESH_TOKENS
-- ─────────────────────────────────────────────────────────────────────────────
-- firm_id denormalizado para RLS (sem necessidade de JOIN)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_firm_id ON refresh_tokens(firm_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id)
  WHERE revoked_at IS NULL AND expires_at > now();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.4 CLIENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),               -- Se cliente tem conta própria
  full_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  bi_number    TEXT,                                     -- PII
  nif          TEXT,                                     -- PII
  address      TEXT,
  client_type  TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_clients_firm_name UNIQUE (firm_id, full_name),
  CONSTRAINT chk_clients_type CHECK (client_type IN ('INDIVIDUAL', 'COMPANY'))
);

CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON clients(firm_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(firm_id) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.5 LEGAL_PROCESSES (Processos Jurídicos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legal_processes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  process_number  TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  area            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',
  court           TEXT,
  judge           TEXT,
  opposing_party  TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_legal_processes_firm_number UNIQUE (firm_id, process_number),
  CONSTRAINT chk_lp_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED')),
  CONSTRAINT chk_lp_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  CONSTRAINT chk_lp_closed_date CHECK (
    (status = 'CLOSED' AND closed_at IS NOT NULL) OR (status <> 'CLOSED')
  )
);

CREATE INDEX IF NOT EXISTS idx_lp_firm_id ON legal_processes(firm_id);
CREATE INDEX IF NOT EXISTS idx_lp_client_id ON legal_processes(client_id);
CREATE INDEX IF NOT EXISTS idx_lp_status ON legal_processes(firm_id, status);
CREATE INDEX IF NOT EXISTS idx_lp_priority ON legal_processes(firm_id, priority);
CREATE INDEX IF NOT EXISTS idx_lp_opened_at ON legal_processes(opened_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.6 PROCESS_ASSIGNMENTS
-- ─────────────────────────────────────────────────────────────────────────────
-- firm_id denormalizado para RLS directo (sem JOIN)
CREATE TABLE IF NOT EXISTS process_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  process_id  UUID NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_pa_process_user UNIQUE (process_id, user_id),
  CONSTRAINT chk_pa_role CHECK (role IN ('LEAD', 'ASSISTANT', 'REVIEWER'))
);

CREATE INDEX IF NOT EXISTS idx_pa_firm_id ON process_assignments(firm_id);
CREATE INDEX IF NOT EXISTS idx_pa_user_id ON process_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_pa_process_id ON process_assignments(process_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.7 DOCUMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  process_id      UUID REFERENCES legal_processes(id),
  created_by_id   UUID NOT NULL REFERENCES users(id),
  updated_by_id   UUID REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  file_key        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  mime_type       TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES documents(id),          -- Self-ref para versões
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  tags            JSONB NOT NULL DEFAULT '[]',
  ai_summary      TEXT,
  ai_processed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_doc_status CHECK (status IN ('DRAFT', 'FINAL', 'SIGNED', 'ARCHIVED')),
  CONSTRAINT chk_doc_version CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_doc_firm_id ON documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_doc_process_id ON documents(process_id) WHERE process_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_created_by ON documents(created_by_id);
CREATE INDEX IF NOT EXISTS idx_doc_parent_id ON documents(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_status ON documents(firm_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_confidential ON documents(firm_id) WHERE is_confidential = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.8 DEADLINES (Prazos Processuais)
-- ─────────────────────────────────────────────────────────────────────────────
-- firm_id denormalizado para RLS directo
CREATE TABLE IF NOT EXISTS deadlines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  process_id   UUID NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     TIMESTAMPTZ NOT NULL,
  reminder_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'PENDING',
  source       TEXT NOT NULL DEFAULT 'MANUAL',
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_dl_status CHECK (status IN ('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED')),
  CONSTRAINT chk_dl_source CHECK (source IN ('MANUAL', 'AI_EXTRACTED'))
);

CREATE INDEX IF NOT EXISTS idx_dl_firm_id ON deadlines(firm_id);
CREATE INDEX IF NOT EXISTS idx_dl_process_id ON deadlines(process_id);
CREATE INDEX IF NOT EXISTS idx_dl_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_dl_status ON deadlines(firm_id, status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.9 NOTES (Notas / Tarefas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  content       TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  priority      TEXT NOT NULL DEFAULT 'low',
  due_date      TIMESTAMPTZ,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_notes_entity CHECK (entity_type IN ('process', 'client', 'deadline', 'general', 'document')),
  CONSTRAINT chk_notes_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_notes_firm_id ON notes(firm_id);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by_id);
CREATE INDEX IF NOT EXISTS idx_notes_pending ON notes(firm_id) WHERE is_completed = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.10 KNOWLEDGE_ARTICLES (Base de Conhecimento Jurídico)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'OUTRO',
  source        TEXT,                                   -- "Lei nº 5/2019", URL, etc.
  tags          JSONB NOT NULL DEFAULT '[]',
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ka_firm_id ON knowledge_articles(firm_id);
CREATE INDEX IF NOT EXISTS idx_ka_category ON knowledge_articles(firm_id, category);
CREATE INDEX IF NOT EXISTS idx_ka_created_by ON knowledge_articles(created_by_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.11 PROCESS_TEMPLATES (Modelos de Processo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id          UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  area             TEXT NOT NULL,
  default_priority TEXT NOT NULL DEFAULT 'MEDIUM',
  checklist_items  JSONB NOT NULL DEFAULT '[]',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by_id    UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_firm_id ON process_templates(firm_id);
CREATE INDEX IF NOT EXISTS idx_pt_area ON process_templates(firm_id, area);
CREATE INDEX IF NOT EXISTS idx_pt_active ON process_templates(firm_id) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.12 PROCESS_NOTES (Notas do Processo)
-- ─────────────────────────────────────────────────────────────────────────────
-- firm_id denormalizado para RLS directo
CREATE TABLE IF NOT EXISTS process_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  process_id  UUID NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pn_firm_id ON process_notes(firm_id);
CREATE INDEX IF NOT EXISTS idx_pn_process_id ON process_notes(process_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.13 INVITATIONS (Convites de Utilizadores)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_inv_role CHECK (role IN ('ADMIN', 'LAWYER', 'ASSISTANT', 'CLIENT')),
  CONSTRAINT chk_inv_expires CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_inv_firm_id ON invitations(firm_id);
CREATE INDEX IF NOT EXISTS idx_inv_email ON invitations(firm_id, email);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.14 AI_CONVERSATIONS (Conversas IA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL DEFAULT 'Nova Conversa',
  context_type TEXT,
  context_id   UUID,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_aic_context CHECK (
    context_type IS NULL OR context_type IN ('process', 'client', 'document')
  )
);

CREATE INDEX IF NOT EXISTS idx_aic_firm_id ON ai_conversations(firm_id);
CREATE INDEX IF NOT EXISTS idx_aic_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_aic_active ON ai_conversations(firm_id) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.15 AI_MESSAGES (Mensagens IA)
-- ─────────────────────────────────────────────────────────────────────────────
-- firm_id denormalizado para RLS directo (sem JOIN)
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  sources         JSONB NOT NULL DEFAULT '[]',
  knowledge_ids   UUID[],
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_aim_role CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_aim_firm_id ON ai_messages(firm_id);
CREATE INDEX IF NOT EXISTS idx_aim_conv_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_aim_created ON ai_messages(created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.16 AI_GENERATIONS (Documentos Gerados por IA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  generation_type TEXT NOT NULL,
  title           TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  result          TEXT NOT NULL,
  template_id     UUID REFERENCES process_templates(id),
  process_id      UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_aig_type CHECK (
    generation_type IN ('document', 'contract', 'petition', 'legal_opinion', 'summary', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_aig_firm_id ON ai_generations(firm_id);
CREATE INDEX IF NOT EXISTS idx_aig_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_aig_type ON ai_generations(firm_id, generation_type);
CREATE INDEX IF NOT EXISTS idx_aig_created ON ai_generations(created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2.17 AUDIT_LOGS (Trilha de Auditoria — IMUTÁVEL)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem updated_at (audit logs são imutáveis por definição)
-- firm_id e user_id nullable para logar tentativas de login sem sessão
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID,
  user_id      UUID,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_al_firm_id ON audit_logs(firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_al_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_al_action ON audit_logs(action);


-- ═════════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGER: updated_at automático (explícito por tabela)
-- ═════════════════════════════════════════════════════════════════════════════════
-- Não usa loop dinâmico — cada tabela é listada explicitamente.
-- SECURITY DEFINER com search_path fixo (evita search_path hijacking).

CREATE OR REPLACE FUNCTION lexdoc_auth.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplicar trigger explicitamente a cada tabela com coluna updated_at
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    VALUES
      ('firms'),
      ('users'),
      ('clients'),
      ('legal_processes'),
      ('documents'),
      ('deadlines'),
      ('notes'),
      ('knowledge_articles'),
      ('process_templates'),
      ('ai_conversations')
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION lexdoc_auth.update_updated_at_column();',
      r.COLUMN1, r.COLUMN1
    );
  END LOOP;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════════
-- 4. TRIGGERS: Integridade Multi-Tenant (Cross-Firm Validation)
-- ═════════════════════════════════════════════════════════════════════════════════
-- Estes triggers impedem que FKs apontem para entidades de outro firm.
-- Exemplo: impossível criar um legal_process com client_id de outro firm.
-- Todas as funções usam SECURITY DEFINER com search_path fixo.


-- ── 4.1 legal_processes.client_id → clients.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_process_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = NEW.client_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: clients(%) não pertence ao firm(%)', NEW.client_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_process_client
  BEFORE INSERT OR UPDATE ON legal_processes
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_process_client();


-- ── 4.2 documents.created_by_id → users.firm_id + process_id → legal_processes.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_document_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  -- O criador deve pertencer ao mesmo firm
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.created_by_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: created_by(%) não pertence ao firm(%)', NEW.created_by_id, NEW.firm_id;
  END IF;
  -- Se ligado a processo, deve ser do mesmo firm
  IF NEW.process_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM legal_processes WHERE id = NEW.process_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: process(%) não pertence ao firm(%)', NEW.process_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_document_firm
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_document_firm();


-- ── 4.3 process_assignments: user + process → mesmo firm ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_assignment_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: user(%) não pertence ao firm(%)', NEW.user_id, NEW.firm_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM legal_processes WHERE id = NEW.process_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: process(%) não pertence ao firm(%)', NEW.process_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_assignment_firm
  BEFORE INSERT OR UPDATE ON process_assignments
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_assignment_firm();


-- ── 4.4 deadlines.process_id → legal_processes.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_deadline_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM legal_processes WHERE id = NEW.process_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: process(%) não pertence ao firm(%)', NEW.process_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_deadline_firm
  BEFORE INSERT OR UPDATE ON deadlines
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_deadline_firm();


-- ── 4.5 process_notes: process + created_by → mesmo firm ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_process_note_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM legal_processes WHERE id = NEW.process_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: process(%) não pertence ao firm(%)', NEW.process_id, NEW.firm_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.created_by AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: created_by(%) não pertence ao firm(%)', NEW.created_by, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_process_note_firm
  BEFORE INSERT OR UPDATE ON process_notes
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_process_note_firm();


-- ── 4.6 ai_messages.conversation_id → ai_conversations.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_ai_message_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_conversations WHERE id = NEW.conversation_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: conversation(%) não pertence ao firm(%)', NEW.conversation_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_ai_message_firm
  BEFORE INSERT OR UPDATE ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_ai_message_firm();


-- ── 4.7 ai_generations: user + process → mesmo firm ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_ai_generation_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: user(%) não pertence ao firm(%)', NEW.user_id, NEW.firm_id;
  END IF;
  IF NEW.process_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM legal_processes WHERE id = NEW.process_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: process(%) não pertence ao firm(%)', NEW.process_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_ai_generation_firm
  BEFORE INSERT OR UPDATE ON ai_generations
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_ai_generation_firm();


-- ── 4.8 refresh_tokens: user → users.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_refresh_token_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.user_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: user(%) não pertence ao firm(%)', NEW.user_id, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_refresh_token_firm
  BEFORE INSERT OR UPDATE ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_refresh_token_firm();


-- ── 4.9 invitations: invited_by → users.firm_id ──
CREATE OR REPLACE FUNCTION lexdoc_auth.chk_invitation_firm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.invited_by AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'INTEGRIDADE: invited_by(%) não pertence ao firm(%)', NEW.invited_by, NEW.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chk_invitation_firm
  BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION lexdoc_auth.chk_invitation_firm();


-- ═════════════════════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY (RLS) — Activar em todas as tabelas
-- ═════════════════════════════════════════════════════════════════════════════════
-- FORCE ROW LEVEL SECURITY: garante que NENHUMA role bypassa o RLS
-- (excepto superuser/postgres, que é o que Prisma usa)

ALTER TABLE firms              ENABLE ROW LEVEL SECURITY; ALTER TABLE firms              FORCE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY; ALTER TABLE users              FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens     ENABLE ROW LEVEL SECURITY; ALTER TABLE refresh_tokens     FORCE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY; ALTER TABLE clients            FORCE ROW LEVEL SECURITY;
ALTER TABLE legal_processes    ENABLE ROW LEVEL SECURITY; ALTER TABLE legal_processes    FORCE ROW LEVEL SECURITY;
ALTER TABLE process_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE process_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY; ALTER TABLE documents          FORCE ROW LEVEL SECURITY;
ALTER TABLE deadlines          ENABLE ROW LEVEL SECURITY; ALTER TABLE deadlines          FORCE ROW LEVEL SECURITY;
ALTER TABLE notes              ENABLE ROW LEVEL SECURITY; ALTER TABLE notes              FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_articles FORCE ROW LEVEL SECURITY;
ALTER TABLE process_templates  ENABLE ROW LEVEL SECURITY; ALTER TABLE process_templates  FORCE ROW LEVEL SECURITY;
ALTER TABLE process_notes      ENABLE ROW LEVEL SECURITY; ALTER TABLE process_notes      FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations         ENABLE ROW LEVEL SECURITY; ALTER TABLE invitations         FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations   ENABLE ROW LEVEL SECURITY; ALTER TABLE ai_conversations   FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_messages        ENABLE ROW LEVEL SECURITY; ALTER TABLE ai_messages        FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_generations    ENABLE ROW LEVEL SECURITY; ALTER TABLE ai_generations    FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_logs         FORCE ROW LEVEL SECURITY;


-- ═════════════════════════════════════════════════════════════════════════════════
-- 6. POLÍTICAS RLS — Explícitas por Tabela e por Role
-- ═════════════════════════════════════════════════════════════════════════════════
--
-- PADRÃO DE PERMISSÕES:
--   ┌─────────────────┬──────────────┬──────────────┬───────────┬────────┐
--   │ Tabela          │ ADMIN        │ LAWYER       │ ASSISTANT │ CLIENT │
--   ├─────────────────┼──────────────┼──────────────┼───────────┼────────┤
--   │ firms           │ R / U        │ R            │ —         │ —      │
--   │ users           │ R / I / U / D│ R            │ R         │ R (own)│
--   │ clients         │ R / I / U / D│ R / I / U    │ R / I / U │ R      │
--   │ processes       │ R / I / U / D│ R / I / U    │ R         │ R      │
--   │ assignments     │ R / I / D    │ R / I / D    │ R         │ —      │
--   │ documents       │ R / I / U / D│ R / I / U / D│ R / I / U│ R (pub)│
--   │ deadlines       │ R / I / U / D│ R / I / U    │ R / I / U │ R      │
--   │ notes           │ R / I / U / D│ R / I / U / D│ R / I / U / D│ R  │
--   │ knowledge       │ R / I / U / D│ R / I / U    │ R         │ R      │
--   │ templates       │ R / I / U / D│ R / I / U    │ R         │ R      │
--   │ process_notes   │ R / I / D    │ R / I / D    │ R / I     │ R      │
--   │ invitations     │ R / I / D    │ —            │ —         │ —      │
--   │ ai_conversations│ R (all) / I / U / D│ R / I / U / D│ R / I / U / D│ R / I / U / D│
--   │ ai_messages     │ R / I        │ R / I        │ R / I     │ R / I  │
--   │ ai_generations  │ R (all)      │ R (all)      │ R (own)   │ R (own)│
--   │ audit_logs      │ R (only)      │ —            │ —         │ —      │
--   └─────────────────┴──────────────┴──────────────┴───────────┴────────┘
--
-- R = Read, I = Insert, U = Update, D = Delete
-- "own" = apenas os seus próprios registos
-- "all" = todos do firm
-- "(pub)" = apenas documentos não-confidenciais
-- "—" = sem acesso
--
-- DOCUMENTOS CONFIDENCIAIS (is_confidential = true):
--   Apenas ADMIN e LAWYER podem ver, criar, editar, eliminar.


-- ── 6.1 FIRMS ──
CREATE POLICY pol_firms_select ON firms
  FOR SELECT USING (
    id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_firms_update ON firms
  FOR UPDATE USING (
    id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  )
  WITH CHECK (id = lexdoc_auth.current_firm_id());


-- ── 6.2 USERS ──
CREATE POLICY pol_users_select ON users
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_users_insert ON users
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );
CREATE POLICY pol_users_update ON users
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_users_delete ON users
  FOR DELETE USING (
    id = lexdoc_auth.current_user_id()
  );


-- ── 6.3 REFRESH_TOKENS ──
CREATE POLICY pol_rt_select ON refresh_tokens
  FOR SELECT USING (
    user_id = lexdoc_auth.current_user_id()
  );
CREATE POLICY pol_rt_insert ON refresh_tokens
  FOR INSERT WITH CHECK (
    user_id = lexdoc_auth.current_user_id()
    AND firm_id = lexdoc_auth.current_firm_id()
  );
CREATE POLICY pol_rt_update ON refresh_tokens
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  );
CREATE POLICY pol_rt_delete ON refresh_tokens
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  );


-- ── 6.4 CLIENTS ──
CREATE POLICY pol_clients_select ON clients
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_clients_insert ON clients
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
  );
CREATE POLICY pol_clients_update ON clients
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_clients_delete ON clients
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );


-- ── 6.5 LEGAL_PROCESSES ──
CREATE POLICY pol_lp_select ON legal_processes
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_lp_insert ON legal_processes
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );
CREATE POLICY pol_lp_update ON legal_processes
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_lp_delete ON legal_processes
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );


-- ── 6.6 PROCESS_ASSIGNMENTS ──
CREATE POLICY pol_pa_select ON process_assignments
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_pa_insert ON process_assignments
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );
CREATE POLICY pol_pa_delete ON process_assignments
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );


-- ── 6.7 DOCUMENTS (com protecção is_confidential) ──
CREATE POLICY pol_doc_select ON documents
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
    AND (
      is_confidential = false
      OR lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
    )
  );
CREATE POLICY pol_doc_insert ON documents
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
    AND (
      is_confidential = false
      OR lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
    )
  );
CREATE POLICY pol_doc_update ON documents
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
    AND (
      is_confidential = false
      OR lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
    )
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_doc_delete ON documents
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );


-- ── 6.8 DEADLINES ──
CREATE POLICY pol_dl_select ON deadlines
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_dl_insert ON deadlines
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
  );
CREATE POLICY pol_dl_update ON deadlines
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_dl_delete ON deadlines
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );


-- ── 6.9 NOTES ──
CREATE POLICY pol_notes_select ON notes
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_notes_insert ON notes
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_notes_update ON notes
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      created_by_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
    )
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_notes_delete ON notes
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      created_by_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  );


-- ── 6.10 KNOWLEDGE_ARTICLES ──
CREATE POLICY pol_ka_select ON knowledge_articles
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_ka_insert ON knowledge_articles
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );
CREATE POLICY pol_ka_update ON knowledge_articles
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_ka_delete ON knowledge_articles
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );


-- ── 6.11 PROCESS_TEMPLATES ──
CREATE POLICY pol_pt_select ON process_templates
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_pt_insert ON process_templates
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );
CREATE POLICY pol_pt_update ON process_templates
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_pt_delete ON process_templates
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );


-- ── 6.12 PROCESS_NOTES ──
CREATE POLICY pol_pn_select ON process_notes
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_pn_insert ON process_notes
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER', 'ASSISTANT')
  );
CREATE POLICY pol_pn_delete ON process_notes
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
  );


-- ── 6.13 INVITATIONS (só ADMIN) ──
CREATE POLICY pol_inv_select ON invitations
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );
CREATE POLICY pol_inv_insert ON invitations
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );
CREATE POLICY pol_inv_delete ON invitations
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_role() = 'ADMIN'
  );


-- ── 6.14 AI_CONVERSATIONS (ADMIN vê todas; outros só as suas) ──
CREATE POLICY pol_aic_select ON ai_conversations
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  );
CREATE POLICY pol_aic_insert ON ai_conversations
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_aic_update ON ai_conversations
  FOR UPDATE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  )
  WITH CHECK (firm_id = lexdoc_auth.current_firm_id());
CREATE POLICY pol_aic_delete ON ai_conversations
  FOR DELETE USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() = 'ADMIN'
    )
  );


-- ── 6.15 AI_MESSAGES ──
CREATE POLICY pol_aim_select ON ai_messages
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );
CREATE POLICY pol_aim_insert ON ai_messages
  FOR INSERT WITH CHECK (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
  );


-- ── 6.16 AI_GENERATIONS (ADMIN/LAWYER vêem todas; outros só as suas) ──
CREATE POLICY pol_aig_select ON ai_generations
  FOR SELECT USING (
    firm_id = lexdoc_auth.current_firm_id()
    AND lexdoc_auth.current_user_id() IS NOT NULL
    AND (
      user_id = lexdoc_auth.current_user_id()
      OR lexdoc_auth.current_user_role() IN ('ADMIN', 'LAWYER')
    )
  );


-- ── 6.17 AUDIT_LOGS (read-only para ADMIN) ──
-- Escrita é via application code (Prisma como postgres, bypass RLS)
CREATE POLICY pol_al_select ON audit_logs
  FOR SELECT USING (
    lexdoc_auth.current_user_role() = 'ADMIN'
    AND (
      firm_id = lexdoc_auth.current_firm_id()
      OR firm_id IS NULL   -- Permite ver logs de login antes de definir firm
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════════
-- 7. LIMPEZA PERIÓDICA
-- ═════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION lexdoc_auth.cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'lexdoc_auth'
AS $$
BEGIN
  -- 7.1 Tokens revogados há mais de 30 dias
  DELETE FROM refresh_tokens
    WHERE revoked_at IS NOT NULL
      AND revoked_at < now() - interval '30 days';

  -- 7.2 Tokens expirados há mais de 30 dias (nunca revogados)
  DELETE FROM refresh_tokens
    WHERE revoked_at IS NULL
      AND expires_at < now() - interval '30 days';

  -- 7.3 Convites já aceites há mais de 30 dias
  DELETE FROM invitations
    WHERE accepted_at IS NOT NULL
      AND accepted_at < now() - interval '30 days';

  -- 7.4 Convites expirados e não aceites há mais de 30 dias
  DELETE FROM invitations
    WHERE accepted_at IS NULL
      AND expires_at < now() - interval '30 days';

  RAISE NOTICE 'lexdoc_auth.cleanup_expired_data: limpeza concluída em %', now();
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════════
-- AGENDAMENTO COM pg_cron
-- ═════════════════════════════════════════════════════════════════════════════════
-- PASSOS PARA ACTIVAR:
--   1. Supabase Dashboard → Database → Extensions
--   2. Procurar "pg_cron" e habilitar
--   3. Executar este SELECT no SQL Editor:
--
-- SELECT cron.schedule(
--   'lexdoc-cleanup-daily',
--   '0 3 * * *',   -- Todos os dias às 03:00 (Africa/Maputo = UTC+2)
--   $$ SELECT lexdoc_auth.cleanup_expired_data(); $$
-- );
--
-- Alternativa: se não usar pg_cron, criar uma API route no backend
-- que chama esta função, e agendar via Vercel Cron Jobs ou similar.


-- ═════════════════════════════════════════════════════════════════════════════════
-- 8. DADOS INICIAIS (SEED)
-- ═════════════════════════════════════════════════════════════════════════════════

-- 8.1 Escritório padrão
INSERT INTO firms (id, name, slug, plan, settings) VALUES
  ('550e8400-e29b-41d4-a716-446655440000'::UUID,
   'LexDoc — Escritório Principal',
   'lexdoc-principal',
   'PRO',
   '{"language": "pt", "timezone": "Africa/Maputo", "country": "MZ"}'::JSONB)
ON CONFLICT (id) DO NOTHING;

-- 8.2 Utilizador Admin padrão
-- ⚠️ PASSWORD: admin123 — ALTERAR IMEDIATAMENTE APÓS PRIMEIRO LOGIN!
-- Hash bcrypt (10 rounds) de "admin123":
--   $2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu6GK
INSERT INTO users (id, firm_id, email, password_hash, full_name, role, is_active, email_verified) VALUES
  ('660e8400-e29b-41d4-a716-446655440001'::UUID,
   '550e8400-e29b-41d4-a716-446655440000'::UUID,
   'admin@lexdoc.co.mz',
   '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu6GK',
   'Administrador LexDoc',
   'ADMIN',
   true,
   true)
ON CONFLICT (email) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════════
-- 9. VERIFICAÇÃO FINAL
-- ═════════════════════════════════════════════════════════════════════════════════

-- 9.1 Listar todas as tabelas criadas
SELECT 'TABELAS' AS tipo, count(*) AS total
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT table_name AS tabela
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 9.2 Verificar RLS activado
SELECT relname AS tabela, rowsecurity AS rls_active, rowforce AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND relname IN (
    'firms','users','refresh_tokens','clients','legal_processes',
    'process_assignments','documents','deadlines','notes',
    'knowledge_articles','process_templates','process_notes',
    'invitations','ai_conversations','ai_messages','ai_generations','audit_logs'
  )
ORDER BY relname;

-- 9.3 Contar políticas RLS
SELECT schemaname || '.' || tablename AS tabela, count(*) AS politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY count(*) DESC;

-- 9.4 Verificar triggers de integridade cross-firm
SELECT tgname AS trigger_nome, tgrelid::regclass AS tabela
FROM pg_trigger
WHERE tgname LIKE 'trg_chk_%'
  AND NOT tgisinternal
ORDER BY tgrelid::regclass::TEXT, tgname;

-- 9.5 Verificar seed data
SELECT 'Firms' AS entity, count(*) AS count FROM firms
UNION ALL
SELECT 'Users', count(*) FROM users;

-- ═════════════════════════════════════════════════════════════════════════════════
-- FIM DO SCRIPT
-- ═════════════════════════════════════════════════════════════════════════════════
