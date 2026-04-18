// ═══════════════════════════════════════════════════════════════
// LEXDOC — Membros do Escritório
// GET /api/v1/firm/members — Listar utilizadores do escritório
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Listar membros do escritório
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(searchParams);
    const search = searchParams.get('search') ?? '';

    // Construir filtros
    const where: Record<string, unknown> = {
      firm_id: payload.firm_id,
    };

    if (search) {
      where.OR = [
        { full_name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Buscar membros
    const [members, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip: calcSkip(page, limit),
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: members,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[FIRM_MEMBERS] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
