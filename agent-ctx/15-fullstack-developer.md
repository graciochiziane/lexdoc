---
Task ID: 15
Agent: full-stack-developer
Task: Build Legal Knowledge Base feature for LexDoc

Work Log:
- Updated prisma/schema.prisma — Added KnowledgeArticle model with fields: id, firm_id, title, content, category, source, tags, is_pinned, view_count, created_by_id, created_at, updated_at. Added reverse relations to Firm (knowledge_articles) and User (knowledge_articles via KnowledgeCreator relation).
- Ran `bun run db:push` — Schema synced to SQLite, Prisma Client regenerated.
- Created src/app/api/v1/knowledge/route.ts — GET (list with search, category filter, pagination, pinned-first ordering) + POST (create with ADMIN/ADVOGADO RBAC, category/tags validation, audit logging)
- Created src/app/api/v1/knowledge/[id]/route.ts — GET (single article with view_count increment), PATCH (update with ADMIN/ADVOGADO RBAC, audit logging), DELETE (ADMIN only, audit logging)
- Created src/app/api/v1/knowledge/stats/route.ts — GET stats (total articles, pinned count, total views, articles by category, recent 5 articles, top 5 most viewed)
- Updated src/lib/api-client.ts — Added KnowledgeArticle interface, KnowledgeStats interface, knowledgeApi (list, get, create, update, remove, stats)
- Created src/components/dashboard/KnowledgeArticleDialog.tsx — View mode (full article with source, tags, view count, date, author, edit/delete actions), Create/Edit mode (form with title, category select, source, tags input, content textarea, pin toggle, validation errors). Emerald gradient header for create, teal for edit. Exports shared constants (CATEGORIES, CATEGORY_COLORS, getCategoryBadge, getCategoryLabel, parseTags).
- Created src/components/dashboard/KnowledgeView.tsx — Main knowledge base view with: stats row (3 cards: total articles, total views, categories count), search bar with category filter dropdown, card grid (1 col mobile, 2 cols tablet, 3 cols desktop), article cards with gradient header by category, pin icon, content preview, source reference, tags as pills, view count, "Ler mais" button, skeleton loaders, animated empty state with floating icons, pagination, create button (ADMIN/ADVOGADO only).
- Updated src/components/views/DashboardView.tsx — Added 'base-conhecimento' to DashboardTab type, added NAV_ITEMS entry with BookOpen icon (visible to all authenticated roles), added to TAB_LABELS, imported KnowledgeView, added renderContent case.
- Fixed TypeScript errors in knowledge/route.ts (non-null assertions for validated fields).
- ESLint: 0 errors, 1 pre-existing warning (form.watch in RegisterForm.tsx).
- TypeScript: 0 new errors from knowledge files.

Stage Summary:
- 3 backend API routes created (knowledge/list+create, knowledge/[id]/get+update+delete, knowledge/stats) — 49 total endpoints
- 2 frontend components created (KnowledgeView, KnowledgeArticleDialog)
- 1 database model added (KnowledgeArticle with 12 Prisma models total)
- 1 API client section added (knowledgeApi with full TypeScript types)
- 1 dashboard tab integrated (base-conhecimento, visible to all authenticated roles)
- All text in Portuguese (pt-MZ)
- Multi-tenant isolation via firm_id on all queries
- RBAC: ADMIN/ADVOGADO can create/edit, ADMIN can delete, all roles can read
- Audit logging on all mutations (KNOWLEDGE_CREATED, KNOWLEDGE_UPDATED, KNOWLEDGE_DELETED)
- 10 legal categories: CONSTITUCIONAL, CIVIL, PENAL, COMERCIAL, TRABALHO, FAMILIA, FISCAL, ADMINISTRATIVO, PROCESSUAL, OUTRO
- Category color-coded badges and gradient card headers
- framer-motion animations (stagger grid, animated empty state, skeleton loaders)
- Responsive design (mobile-first with 1/2/3 column grid)
