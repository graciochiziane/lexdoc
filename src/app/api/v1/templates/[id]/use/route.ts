// ═══════════════════════════════════════════════════════════════
// LEXDOC — Usar Modelo de Processo
// POST /api/v1/templates/:id/use — Criar processo a partir de modelo
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// POST — Criar processo a partir de modelo
// ─────────────────────────────────────────
export async function POST(
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
    const template = await db.processTemplate.findFirst({
      where: { id, firm_id: payload.firm_id, is_active: true },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Modelo não encontrado ou inactivo.' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { client_id, process_number } = body as {
      client_id?: string;
      process_number?: string;
    };

    if (!client_id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'client_id é obrigatório.' } },
        { status: 400 },
      );
    }

    if (!process_number || typeof process_number !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'process_number é obrigatório.' } },
        { status: 400 },
      );
    }

    // Check client belongs to firm
    const client = await db.client.findFirst({
      where: { id: client_id, firm_id: payload.firm_id },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } },
        { status: 404 },
      );
    }

    // Check uniqueness
    const existingProcess = await db.legalProcess.findFirst({
      where: { firm_id: payload.firm_id, process_number: process_number.trim() },
    });

    if (existingProcess) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Número de processo já existe.' } },
        { status: 409 },
      );
    }

    // Parse checklist items
    let checklistItems: Array<{ title: string; description?: string }> = [];
    try {
      checklistItems = JSON.parse(template.checklist_items);
    } catch {
      checklistItems = [];
    }

    // Create process
    const process = await db.legalProcess.create({
      data: {
        firm_id: payload.firm_id,
        client_id,
        process_number: process_number.trim(),
        title: template.title,
        description: template.description,
        area: template.area,
        priority: template.default_priority,
      },
      include: {
        client: { select: { id: true, full_name: true } },
      },
    });

    // Create deadlines from checklist
    const deadlines = checklistItems.map((item) => ({
      process_id: process.id,
      title: item.title,
      description: item.description || null,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'PENDING',
      source: 'TEMPLATE',
    }));

    if (deadlines.length > 0) {
      await db.deadline.createMany({ data: deadlines });
    }

    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PROCESS_CREATED_FROM_TEMPLATE',
      entity_type: 'LegalProcess',
      entity_id: process.id,
      new_values: {
        template_id: id,
        template_title: template.title,
        process_number: process.process_number,
        checklist_count: checklistItems.length,
        client_id,
        client_name: client.full_name,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    const formatted = {
      id: process.id,
      process_number: process.process_number,
      title: process.title,
      description: process.description,
      area: process.area,
      status: process.status,
      priority: process.priority,
      opened_at: process.opened_at,
      created_at: process.created_at,
      client: process.client,
      deadlines_created: checklistItems.length,
    };

    return NextResponse.json({ success: true, data: formatted }, { status: 201 });
  } catch (error) {
    console.error('[TEMPLATE USE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
