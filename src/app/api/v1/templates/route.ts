// ═══════════════════════════════════════════════════════════════
// LEXDOC — Modelos de Processo (Templates)
// GET  /api/v1/templates — Listar modelos
// POST /api/v1/templates — Criar modelo (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

const VALID_AREAS = [
  'CIVIL', 'PENAL', 'TRABALHO', 'COMERCIAL', 'FAMILIA',
  'ADMINISTRATIVO', 'TRIBUTARIO', 'CONSTITUCIONAL', 'OUTRO',
];

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─────────────────────────────────────────
// GET — Listar modelos
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);
    const search = searchParams.get('search')?.trim() || '';
    const area = searchParams.get('area')?.toUpperCase();

    const where: Record<string, unknown> = { firm_id: payload.firm_id, is_active: true };

    if (search) {
      (where as Record<string, unknown[]>)['OR'] = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (area && VALID_AREAS.includes(area)) {
      where.area = area;
    }

    const [total, templates] = await Promise.all([
      db.processTemplate.count({ where }),
      db.processTemplate.findMany({
        where,
        include: {
          created_by: { select: { id: true, full_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formatted = templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      area: t.area,
      default_priority: t.default_priority,
      checklist_items: t.checklist_items,
      is_active: t.is_active,
      created_at: t.created_at,
      updated_at: t.updated_at,
      created_by: t.created_by,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[TEMPLATES LIST] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// POST — Criar modelo
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { title, description, area, default_priority, checklist_items } = body as {
      title?: string;
      description?: string;
      area?: string;
      default_priority?: string;
      checklist_items?: unknown[];
    };

    const errors: string[] = [];

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      errors.push('Título é obrigatório (mínimo 2 caracteres).');
    }

    if (!area || !VALID_AREAS.includes(area.toUpperCase())) {
      errors.push(`Área inválida. Valores: ${VALID_AREAS.join(', ')}`);
    }

    if (default_priority && !VALID_PRIORITIES.includes(default_priority.toUpperCase())) {
      errors.push(`Prioridade inválida. Valores: ${VALID_PRIORITIES.join(', ')}`);
    }

    if (checklist_items && !Array.isArray(checklist_items)) {
      errors.push('checklist_items deve ser um array.');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: errors } },
        { status: 400 },
      );
    }

    const template = await db.processTemplate.create({
      data: {
        firm_id: payload.firm_id,
        title: title.trim(),
        description: description?.trim() || null,
        area: area.toUpperCase(),
        default_priority: default_priority?.toUpperCase() || 'MEDIUM',
        checklist_items: JSON.stringify(checklist_items || []),
        created_by_id: payload.sub,
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
      action: 'TEMPLATE_CREATED',
      entity_type: 'ProcessTemplate',
      entity_id: template.id,
      new_values: { title: template.title, area: template.area },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formatted }, { status: 201 });
  } catch (error) {
    console.error('[TEMPLATES CREATE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
