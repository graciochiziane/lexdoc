// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Gestão de Escritórios
// GET /api/v1/platform/firms — Listar todos os escritórios (SUPER_ADMIN)
// PATCH /api/v1/platform/firms/[id] — Actualizar escritório (SUPER_ADMIN)
// DELETE /api/v1/platform/firms/[id] — Desactivar escritório (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Listar todos os escritórios
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
    const plan = searchParams.get('plan') ?? '';
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (plan) where.plan = plan;
    if (active !== null && active !== undefined && active !== '') {
      where.is_active = active === 'true';
    }

    const [firms, total] = await Promise.all([
      db.firm.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          nif: true,
          oam_number: true,
          is_active: true,
          plan: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              users: true,
              clients: true,
              processes: true,
              documents: true,
              ai_conversations: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: calcSkip(page, limit),
        take: limit,
      }),
      db.firm.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: firms,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[PLATFORM_FIRMS] Erro GET:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}