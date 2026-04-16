// ═══════════════════════════════════════════════════════════════
// LEXDOC — Utilizadores: Desactivar
// PATCH /api/v1/users/:id/deactivate — Desactivar utilizador (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// PATCH — Desactivar utilizador
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN pode desactivar utilizadores
  if (payload.role !== 'ADMIN') {
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
    const { id } = await params;

    // Não permitir desactivar a si próprio
    if (id === payload.sub) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Não pode desactivar o seu próprio utilizador.',
          },
        },
        { status: 403 }
      );
    }

    // Verificar se o utilizador existe e pertence ao escritório
    const existingUser = await db.user.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Verificar se já está desactivado
    if (!existingUser.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Utilizador já se encontra desactivado.',
          },
        },
        { status: 409 }
      );
    }

    // ── Desactivar utilizador ──
    const deactivatedUser = await db.user.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        is_active: true,
        email_verified: true,
        created_at: true,
        last_login_at: true,
      },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'USER_DEACTIVATED',
      entity_type: 'User',
      entity_id: id,
      old_values: { is_active: true },
      new_values: { is_active: false, full_name: deactivatedUser.full_name },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: deactivatedUser });
  } catch (error) {
    console.error('[USERS DEACTIVATE] Erro interno:', error);
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
