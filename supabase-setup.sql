-- ═══════════════════════════════════════════════════════════════════════
-- LEXDOC — Schema Completo para Supabase (PostgreSQL)
-- Plataforma SaaS de Gestão Documental Jurídica — Moçambique
-- ═══════════════════════════════════════════════════════════════════════
-- Instruções:
--   1. Abre o Supabase Dashboard → SQL Editor
--   2. Clica em "New query"
--   3. Cola TODO este SQL e clica "Run"
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- 0. EXTENSÕES
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────
-- 1. FIRMS (Escritórios)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firms (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  nif         TEXT,                              -- PII — protegido
  oam_number  TEXT,                              -- Registo OAM
  is_active   BOOLEAN NOT NULL DEFAULT true,
  plan        TEXT NOT NULL DEFAULT 'STARTER',   -- STARTER | PRO | ENTERPRISE
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firms_slug ON firms(slug);
CREATE INDEX IF NOT EXISTS idx_firms_is_active ON firms(is_active);


-- ─────────────────────────────────────────────
-- 2. USERS (Utilizadores + RBAC)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id            TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'CLIENT',   -- ADMIN | LAWYER | ASSISTANT | CLIENT
  bi_number          TEXT,                              -- PII — protegido
  phone              TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  email_verified     BOOLEAN NOT NULL DEFAULT false,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until       TIMESTAMPTZ,
  mfa_enabled        BOOLEAN NOT NULL DEFAULT false,
  mfa_secret         TEXT,                              -- Encriptado em repouso
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_firm_id ON users(firm_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ─────────────────────────────────────────────
-- 3. REFRESH_TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);


-- ─────────────────────────────────────────────
-- 4. CLIENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id      TEXT REFERENCES users(id),           -- Se cliente tem conta
  full_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  bi_number    TEXT,                                 -- PII
  nif          TEXT,                                 -- PII
  address      TEXT,
  client_type  TEXT NOT NULL DEFAULT 'INDIVIDUAL',  -- INDIVIDUAL | COMPANY
  is_active    BOOLEAN NOT NULL DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON clients(firm_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);


-- ─────────────────────────────────────────────
-- 5. LEGAL_PROCESSES (Processos Jurídicos)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legal_processes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id       TEXT NOT NULL REFERENCES clients(id),
  process_number  TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  area            TEXT NOT NULL,                     -- Área jurídica
  status          TEXT NOT NULL DEFAULT 'ACTIVE',    -- ACTIVE | SUSPENDED | CLOSED | ARCHIVED
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',    -- LOW | MEDIUM | HIGH | URGENT
  court           TEXT,
  judge           TEXT,
  opposing_party  TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_legal_processes_firm_number UNIQUE (firm_id, process_number)
);

CREATE INDEX IF NOT EXISTS idx_legal_processes_firm_id ON legal_processes(firm_id);
CREATE INDEX IF NOT EXISTS idx_legal_processes_client_id ON legal_processes(client_id);
CREATE INDEX IF NOT EXISTS idx_legal_processes_status ON legal_processes(status);
CREATE INDEX IF NOT EXISTS idx_legal_processes_due_date ON legal_processes(opened_at);


-- ─────────────────────────────────────────────
-- 6. PROCESS_ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_assignments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id  TEXT NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL,                         -- Lead | Assistant | Reviewer
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_process_assignments_process_user UNIQUE (process_id, user_id)
);


-- ─────────────────────────────────────────────
-- 7. DOCUMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         TEXT NOT NULL,
  process_id      TEXT REFERENCES legal_processes(id),
  created_by_id   TEXT NOT NULL REFERENCES users(id),
  updated_by_id   TEXT REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  file_key        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,                   -- Bytes
  mime_type       TEXT NOT NULL,                      -- application/pdf, etc.
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       TEXT REFERENCES documents(id),      -- Self-ref para versões
  status          TEXT NOT NULL DEFAULT 'DRAFT',      -- DRAFT | FINAL | SIGNED | ARCHIVED
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  tags            TEXT,                                -- JSON array
  ai_summary      TEXT,
  ai_processed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_firm_id ON documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON documents(process_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by_id ON documents(created_by_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);


-- ─────────────────────────────────────────────
-- 8. DEADLINES (Prazos Processuais)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deadlines (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id   TEXT NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     TIMESTAMPTZ NOT NULL,
  reminder_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | COMPLETED | OVERDUE | CANCELLED
  source       TEXT NOT NULL DEFAULT 'MANUAL',       -- MANUAL | AI_EXTRACTED
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deadlines_process_id ON deadlines(process_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON deadlines(status);


-- ─────────────────────────────────────────────
-- 9. NOTES (Notas / Tarefas)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,                        -- process | client | deadline | general
  entity_id     TEXT,
  content       TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  priority      TEXT NOT NULL DEFAULT 'low',          -- low | medium | high | urgent
  due_date      TIMESTAMPTZ,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_firm_id ON notes(firm_id);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by_id ON notes(created_by_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_completed ON notes(is_completed);


-- ─────────────────────────────────────────────
-- 10. KNOWLEDGE_ARTICLES (Base de Conhecimento)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,                        -- Rich text
  category      TEXT NOT NULL DEFAULT 'OUTRO',
  source        TEXT,                                 -- "Lei nº 5/2019", etc.
  tags          TEXT,                                 -- JSON array
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_firm_id ON knowledge_articles(firm_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_created_by_id ON knowledge_articles(created_by_id);


-- ─────────────────────────────────────────────
-- 11. PROCESS_TEMPLATES (Modelos de Processo)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_templates (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id          TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  area             TEXT NOT NULL,
  default_priority TEXT NOT NULL DEFAULT 'MEDIUM',
  checklist_items  TEXT NOT NULL,                      -- JSON array de {title, description}
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by_id    TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_templates_firm_id ON process_templates(firm_id);
CREATE INDEX IF NOT EXISTS idx_process_templates_area ON process_templates(area);


-- ─────────────────────────────────────────────
-- 12. PROCESS_NOTES (Notas do Processo)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_notes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id  TEXT NOT NULL REFERENCES legal_processes(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  TEXT NOT NULL,                           -- User ID (string)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_notes_process_id ON process_notes(process_id);


-- ─────────────────────────────────────────────
-- 13. INVITATIONS (Convites de Utilizadores)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL,                          -- UserRole
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_firm_id ON invitations(firm_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);


-- ─────────────────────────────────────────────
-- 14. AI_CONVERSATIONS (Conversas IA)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL DEFAULT 'Nova Conversa',
  context_type TEXT,                                   -- process | client | document | null
  context_id   TEXT,                                   -- ID da entidade relacionada
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_firm_id ON ai_conversations(firm_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_is_active ON ai_conversations(is_active);


-- ─────────────────────────────────────────────
-- 15. AI_MESSAGES (Mensagens IA)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                       -- user | assistant | system
  content         TEXT NOT NULL,
  sources         TEXT,                                -- JSON array de fontes/citações
  knowledge_ids   TEXT,                                -- JSON array de IDs
  metadata        TEXT,                                -- JSON: tokens, tempo, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);


-- ─────────────────────────────────────────────
-- 16. AI_GENERATIONS (Documentos Gerados por IA)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_generations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  generation_type TEXT NOT NULL,                       -- document | contract | petition | legal_opinion | summary
  title           TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  result          TEXT NOT NULL,
  template_id     TEXT REFERENCES process_templates(id),
  process_id      TEXT,
  metadata        TEXT,                                -- JSON
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_firm_id ON ai_generations(firm_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_type ON ai_generations(generation_type);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created_at ON ai_generations(created_at);


-- ─────────────────────────────────────────────
-- 17. AUDIT_LOGS (Trilha de Auditoria)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      TEXT REFERENCES firms(id),
  user_id      TEXT REFERENCES users(id),
  action       TEXT NOT NULL,                          -- LOGIN_SUCCESS, LOGIN_FAILED, etc.
  entity_type  TEXT NOT NULL,                          -- Document, User, LegalProcess, etc.
  entity_id    TEXT,
  old_values   TEXT,                                   -- JSON serializado
  new_values   TEXT,                                   -- JSON serializado
  ip_address   TEXT,
  user_agent   TEXT,
  metadata     TEXT,                                   -- JSON adicional
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_firm_id ON audit_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);


-- ═══════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER (auto-update para todas as tabelas com updated_at)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger a todas as tabelas que têm updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT table_name FROM information_schema.columns
             WHERE column_name = 'updated_at'
             AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl
    );
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- DADOS INICIAIS (SEED)
-- ═══════════════════════════════════════════════════════════════════════

-- Escritório padrão
INSERT INTO firms (id, name, slug, plan) VALUES
  ('firm_default_001', 'LexDoc — Escritório Principal', 'lexdoc-principal', 'PRO')
ON CONFLICT (id) DO NOTHING;

-- Utilizador Admin padrão (password: admin123 — alterar após primeiro login!)
-- Hash bcrypt de "admin123"
INSERT INTO users (id, firm_id, email, password_hash, full_name, role, is_active, email_verified) VALUES
  ('user_admin_001', 'firm_default_001', 'admin@lexdoc.co.mz',
   '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu6GK',
   'Administrador LexDoc', 'ADMIN', true, true)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
-- Lista todas as tabelas criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;