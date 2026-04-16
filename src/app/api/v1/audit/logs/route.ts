// ═══════════════════════════════════════════════════════════════
// LEXDOC — Registo de Auditoria (Audit Trail)
// GET /api/v1/audit/logs — Listar logs de auditoria (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Listar logs de auditoria
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  // Apenas ADMIN ou ADVOGADO podem ver logs de auditoria
  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Sem permissão para realizar esta operação.',
        },
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);

    // Filtros opcionais
    const action = searchParams.get('action')?.toUpperCase();
    const entityType = searchParams.get('entity_type');

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entity_type = entityType;
    }

    // Contar total e buscar registos
    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entity_type: true,
          entity_id: true,
          old_values: true,
          new_values: true,
          ip_address: true,
          created_at: true,
          user_id: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Buscar nomes dos utilizadores para todos os logs desta página
    const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))] as string[];
    const userMap = new Map<string, string>();

    if (userIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true },
      });

      for (const user of users) {
        userMap.set(user.id, user.full_name);
      }
    }

    // Formatar logs com nome do utilizador
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      old_values: log.old_values,
      new_values: log.new_values,
      ip_address: log.ip_address,
      created_at: log.created_at,
      user_name: log.user_id ? (userMap.get(log.user_id) ?? 'Desconhecido') : 'Sistema',
    }));

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[AUDIT LOGS] Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor. Tente novamente mais tarde.',
        },
      },
      { status: 500 }
    );
  }
}
