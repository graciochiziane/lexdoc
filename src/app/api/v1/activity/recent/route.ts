// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Actividade Recente
// GET /api/v1/activity/recent?limit=20
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string;
  user_id: string | null;
  description: string;
  created_at: string;
}

// Acções excluídas do feed
const EXCLUDED_ACTIONS = ['SEARCH', 'TOKEN_REFRESH'];

// ─────────────────────────────────────────
// Descrições em Português por acção
// ─────────────────────────────────────────
const ACTION_DESCRIPTIONS: Record<string, (entity: string) => string> = {
  USER_CREATED: (e) => `Criou um novo utilizador`,
  USER_UPDATED: (e) => `Actualizou dados do utilizador`,
  USER_DEACTIVATED: (e) => `Desactivou o utilizador`,
  LOGIN_SUCCESS: () => `Iniciou sessão`,
  LOGIN_FAILED: () => `Tentativa de login falhada`,
  LOGOUT: () => `Terminou sessão`,
  PASSWORD_RESET_REQUESTED: () => `Solicitou redefinição de palavra-passe`,
  PASSWORD_RESET_COMPLETED: () => `Redefiniu a palavra-passe`,
  PASSWORD_CHANGED: () => `Alterou a palavra-passe`,
  CLIENT_CREATED: (e) => `Criou o cliente`,
  CLIENT_UPDATED: (e) => `Actualizou o cliente`,
  PROCESS_CREATED: (e) => `Criou o processo`,
  PROCESS_UPDATED: (e) => `Actualizou o processo`,
  PROCESS_CLOSED: (e) => `Encerrou o processo`,
  DOCUMENT_CREATED: (e) => `Adicionou o documento`,
  DOCUMENT_UPDATED: (e) => `Actualizou o documento`,
  DOCUMENT_ARCHIVED: (e) => `Arquivou o documento`,
  DEADLINE_CREATED: (e) => `Criou o prazo`,
  DEADLINE_UPDATED: (e) => `Actualizou o prazo`,
  INVITATION_CREATED: () => `Enviou um convite`,
  INVITATION_ACCEPTED: () => `Aceitou um convite`,
  INVITATION_REVOKED: () => `Revogou um convite`,
  FIRM_UPDATED: () => `Actualizou configurações do escritório`,
  ACCOUNT_LOCKED: () => `Conta bloqueada por segurança`,
};

function getActionDescription(action: string, entityType: string): string {
  const fn = ACTION_DESCRIPTIONS[action];
  if (fn) return fn(entityType);
  return `Realizou a acção ${action}`;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/activity/recent?limit=20
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  // ── Autenticação ──
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const firmId = payload.firm_id;

  // ── Parâmetros ──
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50) : 20;

  try {
    // Buscar logs de actividade recentes
    const logs = await db.auditLog.findMany({
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
      take: limit,
    });

    const activities: ActivityItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      user_name: log.user?.full_name ?? 'Sistema',
      user_id: log.user_id,
      description: getActionDescription(log.action, log.entity_type),
      created_at: log.created_at.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        activities,
        total: activities.length,
      },
    });
  } catch (error) {
    console.error('[ACTIVITY/RECENT] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
