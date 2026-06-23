// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Todos os Utilizadores
// GET /api/v1/platform/users — Listar utilizadores de todos os escritórios (SUPER_ADMIN)
// PATCH /api/v1/platform/users/[id] — Gerir utilizador (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole, canManageRole } from '@/lib/rbac';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Listar todos os utilizadores
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  if (!hasRole(auth.payload.role, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } },
      { status: 403 },
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(searchParams);
    const search = searchParams.get('search') ?? '';
    const role = searchParams.get('role') ?? '';
    const firm_id = searchParams.get('firm_id') ?? '';
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (firm_id) where.firm_id = firm_id;
    if (active !== null && active !== undefined && active !== '') {
      where.is_active = active === 'true';
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          phone: true,
          is_active: true,
          email_verified: true,
          mfa_enabled: true,
          last_login_at: true,
          created_at: true,
          firm: {
            select: { id: true, name: true, plan: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: calcSkip(page, limit),
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[PLATFORM_USERS] Erro GET:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}