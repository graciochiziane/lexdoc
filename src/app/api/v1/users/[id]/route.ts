// ═══════════════════════════════════════════════════════════════
// LEXDOC — Utilizadores: Obter e Actualizar por ID
// GET   /api/v1/users/:id — Obter utilizador por ID
// PATCH /api/v1/users/:id — Actualizar utilizador (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole, VALID_ROLES } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Obter utilizador por ID
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  try {
    const { id } = await params;

    // Buscar utilizador — filtrar SEMPRE por firm_id
    const user = await db.user.findFirst({
      where: { id, firm_id: payload.firm_id },
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

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[USERS GET] Erro interno:', error);
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

// ─────────────────────────────────────────
// PATCH — Actualizar utilizador
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar utilizadores
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
    const { id } = await params;

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

    // Parsear corpo do pedido
    const body = await request.json();
    const { full_name, email, role, is_active, phone } = body as {
      full_name?: string;
      email?: string;
      role?: string;
      is_active?: boolean;
      phone?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
      errors.push('Nome completo deve ter no mínimo 2 caracteres.');
    }

    if (email !== undefined) {
      if (typeof email !== 'string') {
        errors.push('Email inválido.');
      } else {
        const normalizedEmail = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          errors.push('Formato de email inválido.');
        }
      }
    }

    if (role !== undefined && !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      errors.push('Papel inválido. Valores permitidos: ADMIN, ADVOGADO, SECRETARIO, CLIENT.');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: errors },
        },
        { status: 400 }
      );
    }

    // ── Se alterar email, verificar unicidade no escritório ──
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      const duplicateEmail = await db.user.findFirst({
        where: {
          firm_id: payload.firm_id,
          email: normalizedEmail,
          id: { not: id },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: 'Já existe um utilizador com este email no escritório.',
            },
          },
          { status: 409 }
        );
      }
    }

    // ── Construir dados de actualização ──
    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (full_name !== undefined) {
      oldValues.full_name = existingUser.full_name;
      updateData.full_name = full_name.trim();
      newValues.full_name = updateData.full_name;
    }

    if (email !== undefined) {
      oldValues.email = existingUser.email;
      updateData.email = email.toLowerCase().trim();
      newValues.email = updateData.email;
    }

    if (role !== undefined) {
      oldValues.role = existingUser.role;
      updateData.role = role;
      newValues.role = role;
    }

    if (is_active !== undefined) {
      oldValues.is_active = existingUser.is_active;
      updateData.is_active = is_active;
      newValues.is_active = is_active;
    }

    if (phone !== undefined) {
      oldValues.phone = existingUser.phone;
      updateData.phone = phone?.trim() || null;
      newValues.phone = updateData.phone;
    }

    // Nenhum campo para actualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Nenhum campo fornecido para actualização.',
          },
        },
        { status: 400 }
      );
    }

    // ── Actualizar utilizador ──
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
      action: 'USER_UPDATED',
      entity_type: 'User',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('[USERS UPDATE] Erro interno:', error);
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
