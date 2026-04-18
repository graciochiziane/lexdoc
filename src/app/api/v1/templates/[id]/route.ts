// ═══════════════════════════════════════════════════════════════
// LEXDOC — Modelos de Processo: GET/PATCH/DELETE
// GET    /api/v1/templates/:id — Obter modelo
// PATCH  /api/v1/templates/:id — Actualizar modelo (ADMIN/ADVOGADO)
// DELETE /api/v1/templates/:id — Eliminar modelo (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Obter modelo
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  const { id } = await params;

  try {
    const template = await db.processTemplate.findFirst({
      where: { id, firm_id: payload.firm_id },
      include: {
        created_by: { select: { id: true, full_name: true } },
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado.' } },
        { status: 404 },
      );
    }

    const formatted = {
      id: template.id,
      title: template.title,
      description: template.description,
      area: template.area,
      default_priority: template.default_priority,
      checklist_items: template.checklist_items,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
      created_by: template.created_by,
    };

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[TEMPLATE GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// PATCH — Actualizar modelo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;
  const { id } = await params;

  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } },
      { status: 403 },
    );
  }

  try {
    const existing = await db.processTemplate.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado.' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { title, description, area, default_priority, checklist_items, is_active } = body as {
      title?: string;
      description?: string;
      area?: string;
      default_priority?: string;
      checklist_items?: unknown[];
      is_active?: boolean;
    };

    const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    if (default_priority && !VALID_PRIORITIES.includes(default_priority.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Prioridade inválida.' } },
        { status: 400 },
      );
    }

    const oldValues: Record<string, unknown> = { title: existing.title, area: existing.area };

    const template = await db.processTemplate.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(area ? { area: area.toUpperCase() } : {}),
        ...(default_priority ? { default_priority: default_priority.toUpperCase() } : {}),
        ...(checklist_items ? { checklist_items: JSON.stringify(checklist_items) } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
      },
      include: {
        created_by: { select: { id: true, full_name: true } },
      },
    });

    const formatted = {
      id: template.id,
      title: template.title,
      description: template.description,
      area: template.area,
      default_priority: template.default_priority,
      checklist_items: template.checklist_items,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
      created_by: template.created_by,
    };

    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'TEMPLATE_UPDATED',
      entity_type: 'ProcessTemplate',
      entity_id: id,
      old_values: oldValues,
      new_values: { title: template.title, area: template.area },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[TEMPLATE UPDATE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// DELETE — Eliminar modelo (soft delete via is_active)
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;
  const { id } = await params;

  if (!hasRole(payload.role, ['ADMIN'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão. Apenas administradores.' } },
      { status: 403 },
    );
  }

  try {
    const existing = await db.processTemplate.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado.' } },
        { status: 404 },
      );
    }

    await db.processTemplate.update({
      where: { id },
      data: { is_active: false },
    });

    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'TEMPLATE_DELETED',
      entity_type: 'ProcessTemplate',
      entity_id: id,
      old_values: { title: existing.title },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('[TEMPLATE DELETE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
