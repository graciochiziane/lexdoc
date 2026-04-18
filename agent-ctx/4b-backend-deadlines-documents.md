---
Task ID: 4b
Agent: full-stack-developer (subagent)
Task: LexDoc Backend: Deadlines + Documents CRUD APIs

Work Log:
- Created src/app/api/v1/deadlines/route.ts — GET list (filter by firm_id, process_id, status, search, pagination) + POST create (ADMIN/ADVOGADO only, verifies process ownership, logs DEADLINE_CREATED)
- Created src/app/api/v1/deadlines/[id]/route.ts — GET by ID (verifies firm_id via process) + PATCH update (ADMIN/ADVOGADO, logs DEADLINE_UPDATED + DEADLINE_COMPLETED when status changes to COMPLETED)
- Created src/app/api/v1/processes/[id]/deadlines/route.ts — GET all deadlines for a process (verifies process ownership, supports ?status filter, ordered by due_date ASC)
- Created src/app/api/v1/documents/route.ts — GET list (filter by firm_id, process_id, status, search, tags, pagination; NEVER returns file_key) + POST create metadata (validates tags as JSON array, placeholder file_key, logs DOCUMENT_CREATED)
- Created src/app/api/v1/documents/[id]/route.ts — GET (with created_by info), PATCH (versioning: creates snapshot before update, increments version, sets updated_by_id, logs DOCUMENT_UPDATED), DELETE soft (sets status=ARCHIVED, ADMIN/ADVOGADO only, logs DOCUMENT_DELETED)
- Updated src/app/api/v1/stats/dashboard/route.ts — Added recent_deadlines field (last 5 upcoming PENDING deadlines with process title and process_number)
- ESLint: 0 errors, 1 pre-existing warning (React Compiler + form.watch)

Stage Summary:
- 5 new API route files created, 1 existing file updated
- All routes filter by firm_id (multi-tenant isolation)
- file_key never returned in any document response
- Document versioning: snapshot created on every PATCH, version auto-incremented
- All mutations audit-logged with appropriate actions (DEADLINE_CREATED, DEADLINE_UPDATED, DEADLINE_COMPLETED, DOCUMENT_CREATED, DOCUMENT_UPDATED, DOCUMENT_DELETED)
- RBAC enforced: ADMIN/ADVOGADO for all mutations
- No `any` types used throughout
- All comments in Portuguese
- Standard response format: { success, data, meta? }
