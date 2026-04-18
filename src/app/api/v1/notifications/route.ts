// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Notificações / Feed de Actividade
// Baseado em audit_logs — devolve actividades recentes do escritório
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface NotificationItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Ações irrelevantes para o feed de notificações
const EXCLUDED_ACTIONS = ['SEARCH', 'LOGIN_FAILED', 'LOGIN_SUCCESS', 'TOKEN_REFRESH', 'LOGOUT'];

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/notifications?page=1&limit=20
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  // ── Autenticação ──
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const firmId = payload.firm_id;

  // ── Parâmetros ──
  const { searchParams } = new URL(request.url);

  // Rota de contagem de não lidos
  if (searchParams.get('unread-count') !== null) {
    return getUnreadCount(payload.sub, firmId);
  }

  const { page, limit } = parsePagination(searchParams);
  const skip = calcSkip(page, limit);

  try {
    // Buscar logs de actividade do escritório
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where: {
          firm_id: firmId,
          action: { notIn: EXCLUDED_ACTIONS },
        },
        include: {
          user: {
            select: {
              full_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({
        where: {
          firm_id: firmId,
          action: { notIn: EXCLUDED_ACTIONS },
        },
      }),
    ]);

    const notifications: NotificationItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      user_name: log.user?.full_name ?? 'Sistema',
      user_id: log.user_id,
      created_at: log.created_at.toISOString(),
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        meta: buildPaginationMeta(total, page, limit),
      } satisfies NotificationsResponse,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Contagem de notificações não lidas
// (desde o último login do utilizador)
// ═══════════════════════════════════════════════════════════════
async function getUnreadCount(userId: string, firmId: string) {
  try {
    // Buscar último login do utilizador
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { last_login_at: true },
    });

    const since = user?.last_login_at ?? new Date(0);

    const count = await db.auditLog.count({
      where: {
        firm_id: firmId,
        action: { notIn: EXCLUDED_ACTIONS },
        created_at: { gte: since },
        user_id: { not: userId }, // Excluir próprias acções
      },
    });

    return NextResponse.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('[NOTIFICATIONS/UNREAD] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
