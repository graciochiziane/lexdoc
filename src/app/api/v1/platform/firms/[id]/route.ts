// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Detalhe e Gestão de um Escritório
// GET /api/v1/platform/firms/[id] — Detalhes do escritório
// PATCH /api/v1/platform/firms/[id] — Actualizar escritório
// DELETE /api/v1/platform/firms/[id] — Desactivar escritório
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Detalhes do escritório
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
    const firm = await db.firm.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        nif: true,
        oam_number: true,
        is_active: true,
        plan: true,
        settings: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            users: true,
            clients: true,
            processes: true,
            documents: true,
            ai_conversations: true,
            ai_generations: true,
            deadlines: true,
            knowledge_articles: true,
            invitations: true,
            audit_logs: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
            role: true,
            is_active: true,
            last_login_at: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!firm) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: firm });
  } catch (error) {
    console.error('[PLATFORM_FIRMS_ID] Erro GET:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// PATCH: Actualizar escritório
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
    const { name, nif, oam_number, plan, is_active } = body as {
      name?: string;
      nif?: string;
      oam_number?: string;
      plan?: string;
      is_active?: boolean;
    };

    const existing = await db.firm.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (nif !== undefined) updateData.nif = nif ? String(nif).trim() : null;
    if (oam_number !== undefined) updateData.oam_number = oam_number ? String(oam_number).trim() : null;
    if (plan !== undefined) updateData.plan = String(plan).toUpperCase();
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const firm = await db.firm.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, plan: true, is_active: true, updated_at: true },
    });

    logAudit({
      firm_id: id,
      user_id: auth.payload.sub,
      action: 'PLATFORM_FIRM_UPDATED',
      entity_type: 'Firm',
      entity_id: id,
      old_values: { name: existing.name, plan: existing.plan, is_active: existing.is_active },
      new_values: updateData,
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: firm });
  } catch (error) {
    console.error('[PLATFORM_FIRMS_ID] Erro PATCH:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// DELETE: Desactivar escritório (soft delete)
// ─────────────────────────────────────────
export async function DELETE(
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
    const existing = await db.firm.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' } },
        { status: 404 },
      );
    }

    await db.$transaction([
      db.firm.update({ where: { id }, data: { is_active: false } }),
      db.user.updateMany({ where: { firm_id: id }, data: { is_active: false } }),
    ]);

    logAudit({
      firm_id: id,
      user_id: auth.payload.sub,
      action: 'PLATFORM_FIRM_DEACTIVATED',
      entity_type: 'Firm',
      entity_id: id,
      old_values: { name: existing.name, is_active: true },
      new_values: { is_active: false },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Escritório desactivado com sucesso.' },
    });
  } catch (error) {
    console.error('[PLATFORM_FIRMS_ID] Erro DELETE:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}