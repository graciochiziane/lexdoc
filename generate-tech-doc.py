#!/usr/bin/env python3
"""
LexDoc - Documento Tecnico de Replicacao
Gera PDF completo com todos os detalhes tecnicos do produto.
"""

import sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, SimpleDocTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import hashlib

# ━━ Color Palette (auto-generated) ━━
PAGE_BG       = colors.HexColor('#f1f2f3')
SECTION_BG    = colors.HexColor('#eaeced')
CARD_BG       = colors.HexColor('#ebedef')
TABLE_STRIPE  = colors.HexColor('#eff0f1')
HEADER_FILL   = colors.HexColor('#334e5b')
COVER_BLOCK   = colors.HexColor('#4e5f67')
BORDER        = colors.HexColor('#b3c4cc')
ICON          = colors.HexColor('#3a7998')
ACCENT        = colors.HexColor('#cf5e38')
ACCENT_2      = colors.HexColor('#6ec457')
TEXT_PRIMARY   = colors.HexColor('#141616')
TEXT_MUTED     = colors.HexColor('#858b8e')
SEM_SUCCESS   = colors.HexColor('#3d7a51')
SEM_WARNING   = colors.HexColor('#9f7e3d')
SEM_ERROR     = colors.HexColor('#90453e')
SEM_INFO      = colors.HexColor('#567b9f')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('Calibri', normal='Calibri', bold='Calibri')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━ Styles ━━
W = A4[0] - 2 * inch
H1 = ParagraphStyle('H1', fontName='Times New Roman', fontSize=20, leading=28, textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
H2 = ParagraphStyle('H2', fontName='Times New Roman', fontSize=16, leading=22, textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT)
H3 = ParagraphStyle('H3', fontName='Times New Roman', fontSize=13, leading=18, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT)
BODY = ParagraphStyle('Body', fontName='Times New Roman', fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
BODY_LEFT = ParagraphStyle('BodyLeft', fontName='Times New Roman', fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6)
CODE = ParagraphStyle('Code', fontName='DejaVuSans', fontSize=8.5, leading=13, textColor=TEXT_PRIMARY, backColor=colors.HexColor('#f5f5f5'), leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=4, alignment=TA_LEFT)
TH = ParagraphStyle('TH', fontName='Times New Roman', fontSize=9.5, leading=13, textColor=colors.white, alignment=TA_CENTER)
TC = ParagraphStyle('TC', fontName='Times New Roman', fontSize=9, leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
TC_CENTER = ParagraphStyle('TCC', fontName='Times New Roman', fontSize=9, leading=13, textColor=TEXT_PRIMARY, alignment=TA_CENTER)
CAPTION = ParagraphStyle('Caption', fontName='Times New Roman', fontSize=9, leading=13, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
BULLET = ParagraphStyle('Bullet', fontName='Times New Roman', fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=18, bulletIndent=6, spaceAfter=3)
META = ParagraphStyle('Meta', fontName='Times New Roman', fontSize=9, leading=13, textColor=TEXT_MUTED, alignment=TA_LEFT)
TOC_H1 = ParagraphStyle('TOC_H1', fontName='Times New Roman', fontSize=13, leftIndent=20, textColor=TEXT_PRIMARY, spaceBefore=4, spaceAfter=2)
TOC_H2 = ParagraphStyle('TOC_H2', fontName='Times New Roman', fontSize=11, leftIndent=40, textColor=TEXT_MUTED, spaceBefore=2, spaceAfter=2)

def h1(t): return Paragraph(f'<b>{t}</b>', H1)
def h2(t): return Paragraph(f'<b>{t}</b>', H2)
def h3(t): return Paragraph(f'<b>{t}</b>', H3)
def p(t): return Paragraph(t, BODY)
def pl(t): return Paragraph(t, BODY_LEFT)
def code(t): return Paragraph(t, CODE)
def bullet(t): return Paragraph(t, BULLET)
def meta(t): return Paragraph(t, META)
def sp(h=6): return Spacer(1, h)

def make_table(data, col_ratios, has_header=True):
    cws = [r * W for r in col_ratios]
    t = Table(data, colWidths=cws, hAlign='CENTER')
    style = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    if has_header:
        style.append(('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR))
        style.append(('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT))
        for i in range(1, len(data)):
            bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
            style.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style))
    return t

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    para = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    para.bookmark_name = text
    para.bookmark_level = level
    para.bookmark_text = text
    para.bookmark_key = key
    return para

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ━━ Build Document ━━
OUTPUT = '/home/z/my-project/download/LexDoc_Documento_Tecnico.pdf'
doc = TocDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=inch, rightMargin=inch,
    topMargin=0.8*inch, bottomMargin=0.8*inch,
    title='LexDoc - Documento Tecnico de Replicacao',
    author='Z.ai',
    subject='Technical documentation for replicating the LexDoc legal management platform'
)
story = []

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# COVER PAGE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(Spacer(1, 120))
story.append(Paragraph('<b>LEXDOC</b>', ParagraphStyle('CoverTitle', fontName='Times New Roman', fontSize=42, leading=50, textColor=HEADER_FILL, alignment=TA_CENTER)))
story.append(Spacer(1, 12))
story.append(Paragraph('Documento Tecnico de Replicacao', ParagraphStyle('CoverSub', fontName='Times New Roman', fontSize=18, leading=24, textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(Spacer(1, 8))
story.append(Paragraph('Plataforma SaaS de Gestao Documental Juridica', ParagraphStyle('CoverDesc', fontName='Times New Roman', fontSize=13, leading=18, textColor=ACCENT, alignment=TA_CENTER)))
story.append(Spacer(1, 60))

meta_style = ParagraphStyle('CoverMeta', fontName='Times New Roman', fontSize=11, leading=16, textColor=TEXT_MUTED, alignment=TA_CENTER)
cover_info = [
    [Paragraph('Versao:', meta_style), Paragraph('1.0.0', ParagraphStyle('mv', fontName='Times New Roman', fontSize=11, leading=16, textColor=TEXT_PRIMARY, alignment=TA_CENTER))],
    [Paragraph('Data:', meta_style), Paragraph('2026', ParagraphStyle('mv2', fontName='Times New Roman', fontSize=11, leading=16, textColor=TEXT_PRIMARY, alignment=TA_CENTER))],
    [Paragraph('Stack:', meta_style), Paragraph('Next.js 16 + TypeScript + Tailwind CSS 4 + Prisma + SQLite', ParagraphStyle('mv3', fontName='Times New Roman', fontSize=11, leading=16, textColor=TEXT_PRIMARY, alignment=TA_CENTER))],
    [Paragraph('Classificacao:', meta_style), Paragraph('INTERNO - Confidencial', ParagraphStyle('mv4', fontName='Times New Roman', fontSize=11, leading=16, textColor=SEM_ERROR, alignment=TA_CENTER))],
]
story.append(make_table(cover_info, [0.35, 0.65], has_header=False))
story.append(Spacer(1, 40))
story.append(Paragraph('Este documento contem todos os detalhes tecnicos necessarios para replicar a plataforma LexDoc a partir do zero, incluindo arquitetura, schema de dados, API endpoints, componentes frontend, logica de seguranca e guias de deploy.', ParagraphStyle('CoverNote', fontName='Times New Roman', fontSize=10, leading=15, textColor=TEXT_MUTED, alignment=TA_CENTER, leftIndent=40, rightIndent=40)))

story.append(PageBreak())

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TABLE OF CONTENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(Paragraph('<b>Indice</b>', ParagraphStyle('TOCTitle', fontName='Times New Roman', fontSize=22, leading=28, textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=12)))
toc = TableOfContents()
toc.levelStyles = [TOC_H1, TOC_H2]
story.append(toc)
story.append(PageBreak())

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. VISAO GERAL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('1. Visao Geral do Produto', H1, 0))
story.append(p('LexDoc e uma plataforma SaaS de gestao documental juridica projetada para escritorios de advocacia em Mocambique. Oferece gestão de processos, clientes, documentos, prazos, colaboracao em equipa, e um assistente de IA especializado em direito mocambicano (LexAssistent). Toda a interface esta em Portugues (pt-MZ).'))
story.append(sp())
story.append(h2('1.1 Caracteristicas Principais'))
features = [
    'Gestao completa de processos juridicos com atribuicao a advogados',
    'Gestao de clientes com tipificacao (Individual, Empresarial, Institucional, etc.)',
    'Gestao documental com versionamento e confidencialidade',
    'Calendario de prazos processuais com alertas',
    'Painel analitico com 4 graficos (recharts)',
    'Centro de IA: chat juridico, geracao de documentos, extracao de prazos',
    'Base de conhecimento juridico com artigos pesquisaveis',
    'Quadro Kanban para gestao visual de processos',
    'Sistema de convites para colaboracao em equipa',
    'Pesquisa global com Cmd+K (processos, clientes, documentos, prazos)',
    'Centro de notificacoes com feed de atividade',
    'Exportacao CSV (clientes, processos, auditoria)',
    'Relatorios analiticos com impressao',
    'Modo escuro completo com transicao suave',
    'Onboarding guiado para novos utilizadores',
    'Atalhos de teclado (Ctrl+K, ?)',
]
for f in features:
    story.append(bullet(f))

story.append(sp())
story.append(h2('1.2 Stack Tecnologico'))
stack_data = [
    [Paragraph('<b>Camada</b>', TH), Paragraph('<b>Tecnologia</b>', TH), Paragraph('<b>Versao</b>', TH)],
    [Paragraph('Framework', TC), Paragraph('Next.js 16 (App Router)', TC), Paragraph('16.1.1', TC_CENTER)],
    [Paragraph('Linguagem', TC), Paragraph('TypeScript', TC), Paragraph('5.x', TC_CENTER)],
    [Paragraph('Estilizacao', TC), Paragraph('Tailwind CSS 4', TC), Paragraph('4.x', TC_CENTER)],
    [Paragraph('Componentes UI', TC), Paragraph('shadcn/ui (New York)', TC), Paragraph('-', TC_CENTER)],
    [Paragraph('Animacoes', TC), Paragraph('Framer Motion', TC), Paragraph('12.23.2', TC_CENTER)],
    [Paragraph('ORM', TC), Paragraph('Prisma', TC), Paragraph('6.11.1', TC_CENTER)],
    [Paragraph('Base de Dados', TC), Paragraph('SQLite', TC), Paragraph('-', TC_CENTER)],
    [Paragraph('State Management', TC), Paragraph('Zustand', TC), Paragraph('5.0.6', TC_CENTER)],
    [Paragraph('Server State', TC), Paragraph('TanStack Query', TC), Paragraph('5.82.0', TC_CENTER)],
    [Paragraph('Autenticacao', TC), Paragraph('NextAuth.js v4 / JWT custom', TC), Paragraph('4.24.11', TC_CENTER)],
    [Paragraph('Criptografia', TC), Paragraph('bcryptjs + jsonwebtoken', TC), Paragraph('3.0.3 / 9.0.3', TC_CENTER)],
    [Paragraph('Formularios', TC), Paragraph('React Hook Form + Zod', TC), Paragraph('7.60.0 / 4.0.2', TC_CENTER)],
    [Paragraph('Graficos', TC), Paragraph('Recharts', TC), Paragraph('2.15.4', TC_CENTER)],
    [Paragraph('Markdown', TC), Paragraph('react-markdown + remark-gfm', TC), Paragraph('10.1.0', TC_CENTER)],
    [Paragraph('Temas', TC), Paragraph('next-themes', TC), Paragraph('0.4.6', TC_CENTER)],
    [Paragraph('AI SDK', TC), Paragraph('z-ai-web-dev-sdk (backend only)', TC), Paragraph('0.0.17', TC_CENTER)],
    [Paragraph('Runtime', TC), Paragraph('Bun', TC), Paragraph('-', TC_CENTER)],
]
story.append(sp())
story.append(make_table(stack_data, [0.2, 0.55, 0.25]))
story.append(Paragraph('Tabela 1: Stack tecnologico completo do LexDoc', CAPTION))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. ARQUITECTURA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('2. Arquitetura do Sistema', H1, 0))
story.append(p('O LexDoc segue uma arquitetura monolitica Next.js com App Router. Todo o codigo reside num unico projeto com separacao clara entre frontend e backend via pastas src/app/api (backend) e src/components (frontend). O Prisma serve como ORM com SQLite para persistencia de dados.'))
story.append(sp())
story.append(h2('2.1 Estrutura de Diretorios'))
story.append(code('src/<br/>  app/<br/>    api/v1/            # Backend API routes (50+ endpoints)<br/>    layout.tsx          # Root layout (providers, metadata)<br/>    page.tsx            # Client-side router<br/>    globals.css         # Global styles<br/>  components/<br/>    auth/               # Login, Register, Forgot/Reset Password<br/>    dashboard/          # All dashboard views (25+ components)<br/>    shared/             # MarkdownRenderer<br/>    ui/                 # shadcn/ui components (30+)<br/>  hooks/               # useAuth, useKeyboardShortcuts, use-mobile<br/>  lib/                 # Utilities (auth, rbac, audit, api-client, etc.)<br/>  stores/              # Zustand stores (auth, nav)<br/>  prisma/<br/>    schema.prisma       # Database schema (15 models)<br/>  db/                  # SQLite database file'))
story.append(sp())
story.append(h2('2.2 Fluxo de Autenticacao'))
story.append(p('O sistema utiliza JWT (JSON Web Tokens) com refresh token rotation. O fluxo e o seguinte:'))
story.append(bullet('POST /api/v1/auth/register - Registo com validacao de senha (min 8 chars, maiuscula, minuscula, numero, especial)'))
story.append(bullet('POST /api/v1/auth/login - Login com credenciais. Retorna access_token (15min) + refresh_token (7dias). Rate limit: 5 tentativas/60s, account lockout apos 5 falhas (15min).'))
story.append(bullet('POST /api/v1/auth/refresh - Rotacao do refresh token. O token antigo e revogado e um novo e gerado.'))
story.append(bullet('POST /api/v1/auth/logout - Revogacao do refresh token ativo.'))
story.append(bullet('POST /api/v1/auth/forgot-password - Reset de senha (rate limit: 3 req/hora por IP).'))
story.append(bullet('POST /api/v1/auth/reset-password - Redefinicao com token de validacao.'))
story.append(sp())
story.append(p('O access_token e enviado no header Authorization: Bearer &lt;token&gt;. O interceptor no api-client.ts detecta respostas 401 e tenta renovar automaticamente. Se falhar, redireciona para login.'))

story.append(h2('2.3 Modelo RBAC'))
story.append(p('O sistema implementa 4 niveis hierarquicos de acesso:'))
rbac_data = [
    [Paragraph('<b>Role</b>', TH), Paragraph('<b>Descricao</b>', TH), Paragraph('<b>Permissoes</b>', TH)],
    [Paragraph('ADMIN', TC), Paragraph('Administrador do escritorio', TC), Paragraph('Acesso total a todas as funcionalidades', TC)],
    [Paragraph('ADVOGADO', TC), Paragraph('Advogado senior', TC), Paragraph('CRUD em processos, clientes, documentos, prazos, relatorios, auditoria', TC)],
    [Paragraph('SECRETARIO', TC), Paragraph('Secretario(a)', TC), Paragraph('Leitura de processos, clientes, documentos', TC)],
    [Paragraph('CLIENT', TC), Paragraph('Cliente do escritorio', TC), Paragraph('Apenas visualizacao dos seus proprios processos', TC)],
]
story.append(sp())
story.append(make_table(rbac_data, [0.15, 0.30, 0.55]))
story.append(Paragraph('Tabela 2: Hierarquia RBAC', CAPTION))
story.append(sp())
story.append(p('A verificacao de permissoes e feita em dois niveis: middleware de API (src/lib/api-auth.ts) que valida o JWT e extrai o role, e verificacao inline em cada endpoint que compara o role do utilizador com os papeis permitidos.'))

story.append(h2('2.4 Audit Trail'))
story.append(p('Todas as mutacoes (criar, atualizar, apagar) sao registadas na tabela audit_logs com:'))
story.append(bullet('action: tipo de acao (USER_CREATED, LOGIN_SUCCESS, PROCESS_CREATED, etc.)'))
story.append(bullet('entity_type + entity_id: entidade afectada'))
story.append(bullet('old_values / new_values: estado anterior e novo (JSON serializado)'))
story.append(bullet('ip_address + user_agent: metadados da requisicao'))
story.append(bullet('PII masking: campos como password_hash, nif, bi_number sao removidos dos logs automaticamente.'))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. SCHEMA DE DADOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('3. Schema de Dados (Prisma)', H1, 0))
story.append(p('O schema Prisma define 15 modelos com relacoes em cascata. A base de dados e SQLite, armazenada em db/lexdoc.db. Multi-tenancy e implementado via campo firm_id em todas as entidades principais.'))

models = [
    ('Firm', 'Escritorio juridico. Campos: id, name, slug (unique), nif, oam_number, is_active, plan (STARTER/PROFESSIONAL/ENTERPRISE), created_at, updated_at. Relacoes: tem User[], Client[], Process[], etc.'),
    ('User', 'Utilizador. Campos: id, firm_id, email (unique), password_hash, full_name, role, bi_number (PII), phone, is_active, email_verified, failed_login_count, locked_until, mfa_enabled, mfa_secret, created_at, updated_at, last_login_at.'),
    ('RefreshToken', 'Tokens de sessao. Campos: id, user_id, token_hash (unique), device_info, ip_address, expires_at, revoked_at, created_at.'),
    ('AuditLog', 'Trilha de auditoria. Campos: id, firm_id, user_id, action, entity_type, entity_id, old_values (JSON), new_values (JSON), ip_address, user_agent, metadata (JSON), created_at.'),
    ('Client', 'Cliente do escritorio. Campos: id, firm_id, user_id, full_name, email, phone, bi_number (PII), nif (PII), address, client_type (INDIVIDUAL/EMPRESARIAL/INSTITUCIONAL/GOVERNO/ONG), is_active, notes, created_at, updated_at.'),
    ('LegalProcess', 'Processo juridico. Campos: id, firm_id, client_id, process_number (unique por firm), title, description, area, status (ACTIVE/CLOSED/SUSPENDED/ARCHIVED), priority (HIGH/MEDIUM/LOW), court, judge, opposing_party, opened_at, closed_at, created_at, updated_at.'),
    ('ProcessAssignment', 'Atribuicao processo-advogado. Campos: id, process_id, user_id, role (Lead/Assistant/Reviewer), assigned_at.'),
    ('Document', 'Documento com versionamento. Campos: id, firm_id, process_id, created_by_id, updated_by_id, title, description, file_key, file_name, file_size, mime_type, version (auto-increment), parent_id (self-relation para versoes), status (DRAFT/FINAL/ARCHIVED), is_confidential, tags (JSON), ai_summary, ai_processed_at, created_at, updated_at.'),
    ('Deadline', 'Prazo processual. Campos: id, process_id, title, description, due_date, reminder_at, status (PENDING/COMPLETED/OVERDUE), source (MANUAL/AI), ai_extracted, created_at, updated_at.'),
    ('Note', 'Nota/tarefa. Campos: id, firm_id, entity_type (process/client/deadline/general), entity_id, content, is_pinned, is_completed, priority (low/medium/high/urgent), due_date, created_by_id, created_at, updated_at.'),
    ('KnowledgeArticle', 'Artigo da base de conhecimento. Campos: id, firm_id, title, content (rich text), category, source, tags (JSON), is_pinned, view_count, created_by_id, created_at, updated_at.'),
    ('ProcessTemplate', 'Modelo de processo. Campos: id, firm_id, title, description, area, default_priority, checklist_items (JSON), is_active, created_by_id, created_at, updated_at.'),
    ('ProcessNote', 'Nota de processo. Campos: id, process_id, content, created_by, created_at.'),
    ('Invitation', 'Convite de utilizador. Campos: id, firm_id, email, role, token_hash (unique), expires_at, accepted_at, created_at.'),
    ('AIConversation', 'Conversa com a IA. Campos: id, firm_id, user_id, title, context_type (process/client/document), context_id, is_active, created_at, updated_at. Relacao: tem AIMessage[].'),
    ('AIMessage', 'Mensagem da conversa IA. Campos: id, conversation_id, role (user/assistant/system), content, sources (JSON), knowledge_ids (JSON), metadata (JSON), created_at.'),
    ('AIGeneration', 'Documento gerado por IA. Campos: id, firm_id, user_id, generation_type, title, prompt, result, template_id, process_id, metadata (JSON), created_at.'),
]

for name, desc in models:
    story.append(h3(name))
    story.append(p(desc))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. API ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('4. API Endpoints (50 rotas)', H1, 0))
story.append(p('Todos os endpoints estao sob /api/v1/ e requerem autenticacao JWT (exceto register, login, forgot-password, reset-password, invitation/accept). Filtragem por firm_id e aplicada em todas as queries para isolamento multi-tenant.'))

story.append(h2('4.1 Autenticacao (7 endpoints)'))
auth_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/register', TC), Paragraph('Publica', TC_CENTER), Paragraph('Registo de novo utilizador', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/login', TC), Paragraph('Publica', TC_CENTER), Paragraph('Login com credenciais', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/refresh', TC), Paragraph('Publica', TC_CENTER), Paragraph('Renovar access token', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/logout', TC), Paragraph('JWT', TC_CENTER), Paragraph('Terminar sessao', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/forgot-password', TC), Paragraph('Publica', TC_CENTER), Paragraph('Solicitar reset de senha', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/auth/reset-password', TC), Paragraph('Token', TC_CENTER), Paragraph('Redefinir senha', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/auth/me', TC), Paragraph('JWT', TC_CENTER), Paragraph('Dados do utilizador autenticado', TC)],
]
story.append(sp())
story.append(make_table(auth_api, [0.08, 0.22, 0.12, 0.58]))

story.append(h2('4.2 Utilizadores (3 endpoints)'))
users_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('GET', TC_CENTER), Paragraph('/users?limit=&page=&search=&role=', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar utilizadores (paginado, filtrado)', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/users', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Criar utilizador', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/users/[id]', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Ver/Atualizar utilizador', TC)],
    [Paragraph('PATCH', TC_CENTER), Paragraph('/users/[id]/deactivate', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Desativar utilizador', TC)],
]
story.append(sp())
story.append(make_table(users_api, [0.08, 0.32, 0.10, 0.50]))

story.append(h2('4.3 Clientes (2 endpoints)'))
clients_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('GET/POST', TC_CENTER), Paragraph('/clients', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Criar clientes', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/clients/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Atualizar cliente', TC)],
]
story.append(sp())
story.append(make_table(clients_api, [0.08, 0.22, 0.10, 0.60]))

story.append(h2('4.4 Processos (6 endpoints)'))
proc_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('GET/POST', TC_CENTER), Paragraph('/processes', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Criar processos', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/processes/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Atualizar processo', TC)],
    [Paragraph('PATCH', TC_CENTER), Paragraph('/processes/[id]/close', TC), Paragraph('JWT', TC_CENTER), Paragraph('Fechar processo', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/processes/[id]/deadlines', TC), Paragraph('JWT', TC_CENTER), Paragraph('Prazos do processo', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/processes/[id]/notes', TC), Paragraph('JWT', TC_CENTER), Paragraph('Notas do processo', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/processes/[id]/timeline', TC), Paragraph('JWT', TC_CENTER), Paragraph('Timeline do processo', TC)],
    [Paragraph('PATCH', TC_CENTER), Paragraph('/processes/[id]/status', TC), Paragraph('JWT', TC_CENTER), Paragraph('Alterar status', TC)],
]
story.append(sp())
story.append(make_table(proc_api, [0.08, 0.32, 0.10, 0.50]))

story.append(h2('4.5 Documentos, Prazos e Notas (7 endpoints)'))
doc_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('GET/POST', TC_CENTER), Paragraph('/documents', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Criar documentos', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/documents/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Atualizar documento', TC)],
    [Paragraph('GET/POST', TC_CENTER), Paragraph('/deadlines', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Criar prazos', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/deadlines/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Atualizar prazo', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/deadlines/calendar?month=', TC), Paragraph('JWT', TC_CENTER), Paragraph('Prazos por mes (calendario)', TC)],
    [Paragraph('GET/POST', TC_CENTER), Paragraph('/notes', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Criar notas', TC)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/notes/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Atualizar nota', TC)],
]
story.append(sp())
story.append(make_table(doc_api, [0.08, 0.30, 0.10, 0.52]))

story.append(h2('4.6 Inteligencia Artificial (7 endpoints)'))
ai_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('POST', TC_CENTER), Paragraph('/ai/chat', TC), Paragraph('JWT', TC_CENTER), Paragraph('Chat com LexAssistent', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/ai/conversations', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar conversas', TC)],
    [Paragraph('GET/DELETE', TC_CENTER), Paragraph('/ai/conversations/[id]', TC), Paragraph('JWT', TC_CENTER), Paragraph('Ver/Apagar conversa', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/ai/generate', TC), Paragraph('JWT', TC_CENTER), Paragraph('Gerar documento com IA', TC)],
    [Paragraph('GET/DELETE', TC_CENTER), Paragraph('/ai/generate/list', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar/Apagar geracoes', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/ai/extract-deadlines', TC), Paragraph('JWT', TC_CENTER), Paragraph('Extrair prazos de texto legal', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/ai/analyze', TC), Paragraph('JWT', TC_CENTER), Paragraph('Analise de documento', TC)],
]
story.append(sp())
story.append(make_table(ai_api, [0.08, 0.30, 0.10, 0.52]))

story.append(h2('4.7 Escritorio, Convites, Pesquisa, Exportacao (12 endpoints)'))
extra_api = [
    [Paragraph('<b>Metodo</b>', TH), Paragraph('<b>Rota</b>', TH), Paragraph('<b>Auth</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('GET/PATCH', TC_CENTER), Paragraph('/firm/settings', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Ver/Editar configuracoes do escritorio', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/firm/members', TC), Paragraph('JWT', TC_CENTER), Paragraph('Listar membros do escritorio', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/invitations', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Criar convite', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/invitations', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Listar convites', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/invitations/[token]', TC), Paragraph('Publica', TC_CENTER), Paragraph('Validar token de convite', TC)],
    [Paragraph('DELETE', TC_CENTER), Paragraph('/invitations/[token]', TC), Paragraph('ADMIN', TC_CENTER), Paragraph('Revogar convite', TC)],
    [Paragraph('POST', TC_CENTER), Paragraph('/invitations/[token]/accept', TC), Paragraph('Publica', TC_CENTER), Paragraph('Aceitar convite (cria utilizador)', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/search?q=', TC), Paragraph('JWT', TC_CENTER), Paragraph('Pesquisa global', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/notifications', TC), Paragraph('JWT', TC_CENTER), Paragraph('Feed de notificacoes', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/notifications?unread-count', TC), Paragraph('JWT', TC_CENTER), Paragraph('Contagem de nao lidas', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/export/clients', TC), Paragraph('ADMIN/ADV', TC_CENTER), Paragraph('Exportar clientes CSV', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/export/processes', TC), Paragraph('ADMIN/ADV', TC_CENTER), Paragraph('Exportar processos CSV', TC)],
    [Paragraph('GET', TC_CENTER), Paragraph('/export/audit', TC), Paragraph('ADMIN/ADV', TC_CENTER), Paragraph('Exportar auditoria CSV', TC)],
]
story.append(sp())
story.append(make_table(extra_api, [0.08, 0.32, 0.12, 0.48]))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. COMPONENTES FRONTEND
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('5. Componentes Frontend', H1, 0))
story.append(p('A interface do LexDoc e constituida por 3 vistas principais (LoginView, RegisterView, DashboardView) e 25+ componentes de dashboard. Toda a estilizacao utiliza shadcn/ui (New York style) com acento emerald verde, Framer Motion para animacoes, e Tailwind CSS 4.'))

story.append(h2('5.1 Vistas Principais'))
views_data = [
    [Paragraph('<b>Componente</b>', TH), Paragraph('<b>Ficheiro</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('LoginView', TC), Paragraph('views/LoginView.tsx', TC), Paragraph('Pagina de login com fundo animado, logo shield, trust badges, link "Esqueceu a senha?"', social proof', TC)],
    [Paragraph('RegisterView', TC), Paragraph('views/RegisterView.tsx', TC), Paragraph('Pagina de registo com validacao de forca, seletor de role, deteccao de token de convite', TC)],
    [Paragraph('DashboardView', TC), Paragraph('views/DashboardView.tsx', TC), Paragraph('Layout principal com sidebar colapsavel, header sticky, 15 abas de navegacao, rodape com relogio', TC)],
]
story.append(sp())
story.append(make_table(views_data, [0.15, 0.25, 0.60]))

story.append(h2('5.2 Componentes do Dashboard'))
dash_components = [
    ('DashboardHome', 'Painel com 4 graficos recharts (status pie, mensal bar, priority bars, timeline), estatisticas animadas, welcome card, quick stats row, activity feed'),
    ('ProcessesView', 'CRUD de processos com tabs de status, filtros (area, prioridade), dialogo de detalhe com prazos, exportacao CSV'),
    ('ClientsView', 'CRUD de clientes com tipo badges, busca, filtros, exportacao CSV'),
    ('DocumentsView', 'CRUD de documentos com MIME badges, versioning, confidencialidade, filtros'),
    ('DeadlinesView', 'Gestao de prazos com cards coloridos (overdue=red, due_soon=amber, upcoming=emerald), tabs de status'),
    ('CalendarView', 'Calendario mensal com dots coloridos, filtro por processo, popover de detalhes no dia'),
    ('UsersView', 'CRUD de utilizadores com badges de role, busca, ativacao/desativacao'),
    ('AuditView', 'Dual view (timeline + tabela) com filtros de acao/entidade, icons coloridos'),
    ('ReportsView', '7 seccoes analiticas com graficos recharts, resumo executivo, botao de impressao'),
    ('AIHubView', 'Centro de IA com 4 tabs: Chat (LexAssistent), Gerar Documento, Extrair Prazos, Historico'),
    ('KnowledgeView', 'Base de conhecimento juridico com artigos pesquisaveis, categorias, criacao/edicao'),
    ('KanbanBoard', 'Quadro Kanban para gestao visual de processos com drag-and-drop'),
    ('TemplatesView', 'Modelos de processo com checklist configuravel'),
    ('TaskManager', 'Gestao de tarefas com prioridades e filtros'),
    ('InvitationsView', 'Sistema de convites com tabela, busca, aceitacao/revogacao'),
    ('NotificationsCenter', 'Centro de notificacoes com feed de atividade detalhado'),
    ('QuickActionsFAB', 'Botao flutuante com speed dial (Novo Processo, Cliente, Prazo, Documento)'),
    ('SearchBar', 'Command palette (Ctrl+K) com resultados agrupados por entidade'),
    ('OnboardingGuide', 'Guia de 5 passos para novos utilizadores com progresso e localStorage'),
    ('ProfileDialog', 'Dialogo de perfil com edicao de info e alteracao de senha'),
    ('FirmSettingsDialog', 'Configuracoes do escritorio (nome, NIF, OAM, plano, membros)'),
]
for name, desc in dash_components:
    story.append(h3(name))
    story.append(p(desc))

story.append(h2('5.3 Bibliotecas Chave'))
libs_data = [
    [Paragraph('<b>Ficheiro</b>', TH), Paragraph('<b>Funcao</b>', TH)],
    [Paragraph('api-client.ts', TC), Paragraph('Cliente API tipado com TanStack Query. Metodos para todos os endpoints: authApi, usersApi, clientsApi, processesApi, deadlinesApi, documentsApi, aiApi, searchApi, notificationsApi, profileApi, firmApi, invitationsApi, exportApi, activityApi, knowledgeApi, templatesApi, notesApi', TC)],
    [Paragraph('api-auth.ts', TC), Paragraph('Middleware JWT: extrai token do header, valida assinatura, extrai payload com user_id e role. Exporta requireAuth(roles?) e optionalAuth().', TC)],
    [Paragraph('auth.ts', TC), Paragraph('Utilitarios: hashPassword (bcrypt), verifyPassword, generateTokenPair, verifyToken (com verificacao de revoked_at via reset-token-store.ts)', TC)],
    [Paragraph('rbac.ts', Paragraph('Hierarquia de roles: ADMIN > ADVOGADO > SECRETARIO > CLIENT. Funcao hasAccess(userRole, requiredRoles) para verificar permissao.', TC)],
    [Paragraph('rate-limit.ts', TC), Paragraph('Rate limiter em memoria com 3 buckets: login (5/60s), forgot-password (3/hora), geral (100/min). Auto-cleanup de entradas expiradas.', TC)],
    [Paragraph('audit.ts', Paragraph('logAction(firm_id, user_id, action, entity_type, entity_id, old_values, new_values, req). Mascara PII automaticamente.', TC)],
    [Paragraph('pagination.ts', TC), Paragraph('parsePagination(searchParams): extrai limit, page, search, sort, sortDirection. buildPaginationMeta(total, limit, page): gera meta com totalPages.', TC)],
]
story.append(sp())
story.append(make_table(libs_data, [0.20, 0.80]))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. GUIA DE REPLICACAO
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('6. Guia Passo-a-Passo de Replicacao', H1, 0))

story.append(h2('6.1 Prerequisitos'))
story.append(bullet('Node.js 18+ ou Bun (runtime JavaScript)'))
story.append(bullet('SQLite 3 (geralmente incluido no SO)'))
story.append(bullet('Git'))

story.append(h2('6.2 Inicializacao do Projeto'))
story.append(code('bun create next-app lexdoc --typescript --tailwind --eslint --app --src-dir<br/>cd lexdoc<br/>bun install'))
story.append(sp())
story.append(h2('6.3 Instalacao de Dependencias'))
story.append(code('bun install next@latest react@latest react-dom@latest typescript@latest<br/>bun install @prisma/client prisma<br/>bun install next-auth@4 next-themes zustand @tanstack/react-query @tanstack/react-table<br/>bun install framer-motion lucide-react react-hook-form @hookform/resolvers zod<br/>bun install jsonwebtoken bcryptjs date-fns date-fns-tz recharts<br/>bun install react-markdown remark-gfm react-syntax-highlighter<br/>bun install cmdk sonner class-variance-authority clsx tailwind-merge<br/>bun install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities<br/>bun install react-day-picker vaul react-resizable-panels<br/>bun install z-ai-web-dev-sdk  # Para funcionalidades de IA no backend'))

story.append(h2('6.4 Configuracao shadcn/ui'))
story.append(p('Instalar o CLI do shadcn/ui e adicionar componentes necessarios:'))
story.append(code('npx shadcn@latest init -y --style new-york --base-color neutral<br/>npx shadcn@latest add button card input textarea badge scroll-area separator<br/>npx shadcn@latest add skeleton avatar select dialog sheet tabs accordion<br/>npx shadcn@latest add dropdown-menu context-menu popover tooltip alert<br/>npx shadcn@latest add navigation-menu menubar toggle toggle-group<br/>npx shadcn@latest add progress slider checkbox radio-group<br/>npx shadcn@latest add table data-table calendar input-otp collapsible<br/>npx shadcn@latest add sonner command form label'))

story.append(h2('6.5 Configuracao Prisma'))
story.append(code('bunx prisma init --datasource-provider sqlite<br/># Editar .env: DATABASE_URL="file:./db/lexdoc.db"<br/>bunx prisma db push<br/>bunx prisma generate'))

story.append(h2('6.6 Configuracao do Ambiente (.env)'))
story.append(code('DATABASE_URL="file:./db/lexdoc.db"<br/>JWT_SECRET="<gerar-string-aleatoria-32-chars>"<br/>NEXTAUTH_SECRET="<gerar-string-aleatoria>"<br/>NEXTAUTH_URL="http://localhost:3000"'))

story.append(h2('6.7 Estrutura de Pastas a Criar'))
story.append(code('src/<br/>  app/<br/>    api/v1/auth/<br/>    api/v1/users/<br/>    api/v1/clients/<br/>    api/v1/processes/<br/>    api/v1/documents/<br/>    api/v1/deadlines/<br/>    api/v1/ai/<br/>    api/v1/firm/<br/>    api/v1/invitations/<br/>    api/v1/search/<br/>    api/v1/notifications/<br/>    api/v1/notifications/unread-count/<br/>    api/v1/profile/<br/>    api/v1/stats/<br/>    api/v1/audit/<br/>    api/v1/reports/<br/>    api/v1/export/<br/>    api/v1/knowledge/<br/>    api/v1/templates/<br/>    api/v1/notes/<br/>    api/v1/activity/<br/>    api/v1/import/<br/>  components/<br/>    auth/  # LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, PasswordStrengthIndicator<br/>    views/  # LoginView, RegisterView, DashboardView<br/>    dashboard/  # Todos os 25+ componentes listados na Secao 5<br/>    shared/  # MarkdownRenderer<br/>    ui/  # Todos os componentes shadcn/ui<br/>  hooks/  # useAuth, useKeyboardShortcuts, use-mobile, use-toast<br/>  lib/  # auth.ts, api-auth.ts, rbac.ts, rate-limit.ts, audit.ts, etc.<br/>  stores/  # auth.store.ts, nav.store.ts<br/>prisma/<br/>  schema.prisma  # Copiar schema completo da Secao 3<br/>db/<br/>  .gitkeep'))

story.append(h2('6.8 Execucao em Desenvolvimento'))
story.append(code('bun run dev     # Inicia servidor na porta 3000<br/>bun run db:push  # Aplica schema ao SQLite<br/>bun run lint      # Verifica qualidade do codigo'))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. SEGURANCA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('7. Modelo de Seguranca', H1, 0))

story.append(h2('7.1 Autenticacao JWT'))
story.append(bullet('Access Token: expira em 15 minutos. Enviado no header Authorization: Bearer &lt;token&gt;.'))
story.append(bullet('Refresh Token: expira em 7 dias. Hash armazenado na BD (nunca em texto limpo). Rotacao: cada uso revoga o anterior e gera um novo.'))
story.append(bullet('Interceptor no api-client.ts: tenta renovar automaticamente em 401. Se falhar, redireciona para login.'))

story.append(h2('7.2 Protecao PII'))
story.append(bullet('Campos PII (password_hash, nif, bi_number, email) nunca sao retornados em respostas API.'))
story.append(bullet('Audit logs: a funcao audit.ts mascara automaticamente campos PII antes de registar.'))
story.append(bullet('Search results: campos PII filtrados dos resultados de pesquisa.'))

story.append(h2('7.3 Rate Limiting'))
story.append(bullet('Login: 5 tentativas por 60 segundos por IP.'))
story.append(bullet('Forgot Password: 3 requisicoes por hora por IP.'))
story.append(bullet('Geral: 100 requisicoes por minuto por IP.'))
story.append(bullet('Account Lockout: 5 falhas consecutivas = bloqueio de 15 minutos (locked_until).'))

story.append(h2('7.4 Account Lockout'))
story.append(p('Apos 5 falhas consecutivas de login, a conta e bloqueada por 15 minutos. O campo locked_until e preenchido com DateTime.now() + 15min. O login verifica este campo e retorna erro 403 com mensagem generica (nao revela se a conta existe ou esta bloqueada).'))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. CONFIGURACAO E DEPLOY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('8. Configuracao e Deploy', H1, 0))

story.append(h2('8.1 Variaveis de Ambiente'))
env_data = [
    [Paragraph('<b>Variavel</b>', TH), Paragraph('<b>Obrigatorio</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('DATABASE_URL', TC), Paragraph('Sim', TC), Paragraph('Caminho para o ficheiro SQLite (ex: file:./db/lexdoc.db)', TC)],
    [Paragraph('JWT_SECRET', TC), Paragraph('Sim', TC), Paragraph('Chave secreta para assinar/verificar JWT (min 32 chars)', TC)],
    [Paragraph('NEXTAUTH_SECRET', TC), Paragraph('Sim', TC), Paragraph('Segredo para NextAuth (se utilizado)', TC)],
    [Paragraph('NEXTAUTH_URL', TC), Paragraph('Sim', TC), Paragraph('URL base da aplicacao', TC)],
]
story.append(sp())
story.append(make_table(env_data, [0.22, 0.12, 0.66]))

story.append(h2('8.2 Scripts Disponive'))
scripts_data = [
    [Paragraph('<b>Comando</b>', TH), Paragraph('<b>Descricao</b>', TH)],
    [Paragraph('bun run dev', TC), Paragraph('Servidor de desenvolvimento na porta 3000 com hot reload'), Paragraph('TC_LEFT')],
    [Paragraph('bun run build', TC), Paragraph('Build de producao (standalone output)'), Paragraph('TC_LEFT')],
    [Paragraph('bun run start', TC), Paragraph('Inicia servidor de producao (standalone)'), Paragraph('TC_LEFT')],
    [Paragraph('bun run lint', TC), Paragraph('ESLint para verificacao de qualidade'), Paragraph('TC_LEFT')],
    [Paragraph('bun run db:push', TC), Paragraph('Aplica schema Prisma ao SQLite'), Paragraph('TC_LEFT')],
    [Paragraph('bun run db:generate', TC), Paragraph('Gera Prisma Client types'), Paragraph('TC_LEFT')],
]
story.append(sp())
story.append(make_table(scripts_data, [0.22, 0.78]))

story.append(h2('8.3 Deploy em Producao'))
story.append(p('Para deploy, o LexDoc suporta modo standalone do Next.js:'))
story.append(code('bun run build    # Gera .next/standalone/<br/>NODE_ENV=production bun .next/standalone/server.js'))
story.append(p('Recomenda-se usar um processo manager como PM2, systemd, ou Docker para gestao do servidor em producao. A porta padrao e 3000.'))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. NOTAS FINAIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(add_heading('9. Notas Tecnicas Adicionais', H1, 0))

story.append(h2('9.1 Internacionalizacao'))
story.append(p('Toda a interface esta em Portugues (pt-MZ, locale de Mocambique). As datas utilizam formatacao pt-MZ. O sistema usa next-intl para i18n mas atualmente apenas pt esta implementado.'))

story.append(h2('9.2 Tema e Estilizacao'))
story.append(bullet('Cor principal: Emerald (#10B981) com variantes (500/600/700/800/900).'))
story.append(bullet('Sidebar: fundo escuro (#0f0f1e) com texto branco e indicadores emerald com glow.'))
story.append(bullet('Dark mode: suportado via next-themes com transicao suave (0.2s).'))
story.append(bullet('Animacoes: Framer Motion para transicoes de pagina, hover effects, e micro-interacoes.'))
story.append(bullet('Scrollbars: estilizadas com CSS custom (thin, 6px, emerald accent on hover).'))

story.append(h2('9.3 Estado Atual e Limitacoes'))
story.append(bullet('In-memory rate limiting: reinicia no restart do servidor (aceitavel para demo).'))
story.append(bullet('SQLite: sem vector search nativo para RAG (planejado para migracao futura).'))
story.append(bullet('Sem upload de ficheiros: gestao de documentos e apenas metadata; storage de ficheiros nao implementado.'))
story.append(bullet('Sem testes unitarios: cobertura de testes nao implementada.'))
story.append(bullet('Email: verificacao de email, reset de senha via email nao implementados.'))
story.append(bullet('MFA: campos mfa_enabled/mfa_secret existem mas MFA nao implementado.'))

# ━━ Build ━━
print("Building PDF...")
doc.multiBuild(story)
print(f"PDF generated: {OUTPUT}")
print(f"File size: {os.path.getsize(OUTPUT) / 1024:.1f} KB")