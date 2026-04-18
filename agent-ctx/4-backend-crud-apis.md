---
Task ID: 4
Agent: fullstack-developer (subagent)
Task: LexDoc Backend CRUD APIs — Users, Clients, Processes, Stats, Audit

Work Log:
- Created `/src/lib/api-auth.ts` — Authentication middleware helper with JWT extraction and verification
- Created `/src/lib/pagination.ts` — Shared pagination utilities (parsePagination, buildPaginationMeta, calcSkip)
- Created `/src/app/api/v1/users/route.ts` — GET (list users with search, role filter, pagination) + POST (create user with bcrypt hash)
- Created `/src/app/api/v1/users/[id]/route.ts` — GET (single user) + PATCH (update user, ADMIN/ADVOGADO only)
- Created `/src/app/api/v1/users/[id]/deactivate/route.ts` — PATCH (deactivate user, ADMIN only, self-deactivation blocked)
- Created `/src/app/api/v1/clients/route.ts` — GET (list clients with search, type filter) + POST (create client)
- Created `/src/app/api/v1/clients/[id]/route.ts` — GET (single client) + PATCH (update client, ADMIN/ADVOGADO only)
- Created `/src/app/api/v1/processes/route.ts` — GET (list with search/status/area/priority filters) + POST (create with unique process_number check)
- Created `/src/app/api/v1/processes/[id]/route.ts` — GET (with client, documents_count, deadlines_count) + PATCH (update process)
- Created `/src/app/api/v1/processes/[id]/close/route.ts` — PATCH (close process, sets status=CLOSED, closed_at)
- Created `/src/app/api/v1/stats/dashboard/route.ts` — GET (aggregated stats: processes, clients, documents, deadlines, recent activities)
- Created `/src/app/api/v1/audit/logs/route.ts` — GET (paginated audit logs with user_name join, ADMIN/ADVOGADO only)

Stage Summary:
- 15 backend files created (2 lib utilities + 13 API route files)
- Every route uses `authenticateRequest()` for JWT auth
- Every query filters by `firm_id` for multi-tenant isolation
- PII fields (password_hash, bi_number, nif, mfa_secret) never returned in responses
- All mutations logged to audit service (USER_CREATED, USER_UPDATED, USER_DEACTIVATED, CLIENT_CREATED, CLIENT_UPDATED, PROCESS_CREATED, PROCESS_UPDATED, PROCESS_CLOSED)
- Pagination support with `page`, `limit`, `search` parameters across all list endpoints
- RBAC enforcement: ADMIN for deactivation, ADMIN/ADVOGADO for creates/updates
- All comments in Portuguese
- `process.env.TZ = 'Africa/Maputo'` at top of every route file
- Lint: 0 new errors (2 pre-existing issues in other agents' files)
- Dev server compiles successfully with all new routes
