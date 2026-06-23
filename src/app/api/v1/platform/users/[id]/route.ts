// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Gerir Utilizador Individual
// GET /api/v1/platform/users/[id] — Detalhes
// PATCH /api/v1/platform/users/[id] — Alterar role, activar/desactivar
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole, canManageRole, VALID_ROLES } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Detalhes do utilizador
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  if (!hasRole(auth.payload.role, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        bi_number: true,
        is_active: true,
        email_verified: true,
        mfa_enabled: true,
        failed_login_count: true,
        locked_until: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        firm: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            is_active: true,
          },
        },
        _count: {
          select: {
            documents_created: true,
            process_assignments: true,
            notes: true,
            knowledge_articles: true,
            ai_conversations: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[PLATFORM_USERS_ID] Erro GET:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// PATCH: Gerir utilizador (role, active state)
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  if (!hasRole(auth.payload.role, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { role, is_active } = body as {
      role?: string;
      is_active?: boolean;
    };

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, is_active: true, firm_id: true },
    });

    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' } },
        { status: 404 },
      );
    }

    // Não se pode gerir a si próprio
    if (target.id === auth.payload.sub) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Não pode modificar o seu próprio utilizador.' } },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Papel inválido.' } },
          { status: 400 },
        );
      }
      if (!canManageRole(auth.payload.role, role)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão para atribuir este papel.' } },
          { status: 403 },
        );
      }
      updateData.role = role;
      changes.role = { from: target.role, to: role };
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
      changes.is_active = { from: target.is_active, to: is_active };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Nenhum campo para actualizar.' } },
        { status: 400 },
      );
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        updated_at: true,
      },
    });

    logAudit({
      firm_id: target.firm_id,
      user_id: auth.payload.sub,
      action: 'PLATFORM_USER_UPDATED',
      entity_type: 'User',
      entity_id: id,
      old_values: { role: target.role, is_active: target.is_active },
      new_values: changes,
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[PLATFORM_USERS_ID] Erro PATCH:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}