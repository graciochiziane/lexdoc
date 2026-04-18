// ═══════════════════════════════════════════════════════════════
// LEXDOC — Processos Jurídicos: Obter e Actualizar por ID
// GET   /api/v1/processes/:id — Obter processo com detalhes
// PATCH /api/v1/processes/:id — Actualizar processo (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Valores válidos
// ─────────────────────────────────────────
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─────────────────────────────────────────
// GET — Obter processo por ID com detalhes
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

    // Buscar processo — filtrar SEMPRE por firm_id
    const process = await db.legalProcess.findFirst({
      where: { id, firm_id: payload.firm_id },
      include: {
        client: {
          select: { id: true, full_name: true },
        },
        documents: {
          select: { id: true },
        },
        deadlines: {
          select: { id: true },
        },
      },
    });

    if (!process) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Processo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Formatar resposta
    const formattedProcess = {
      id: process.id,
      process_number: process.process_number,
      title: process.title,
      description: process.description,
      area: process.area,
      status: process.status,
      priority: process.priority,
      court: process.court,
      judge: process.judge,
      opposing_party: process.opposing_party,
      opened_at: process.opened_at,
      closed_at: process.closed_at,
      created_at: process.created_at,
      updated_at: process.updated_at,
      client: process.client,
      documents_count: process.documents.length,
      deadlines_count: process.deadlines.length,
    };

    return NextResponse.json({ success: true, data: formattedProcess });
  } catch (error) {
    console.error('[PROCESSES GET] Erro interno:', error);
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
// PATCH — Actualizar processo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar processos
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

    // Verificar se o processo existe e pertence ao escritório
    const existingProcess = await db.legalProcess.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingProcess) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Processo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { title, description, status, priority, court, judge, opposing_party } = body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      court?: string;
      judge?: string;
      opposing_party?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
      errors.push('Título deve ter no mínimo 2 caracteres.');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push('Estado inválido. Valores permitidos: ACTIVE, SUSPENDED, CLOSED, ARCHIVED.');
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority.toUpperCase())) {
      errors.push('Prioridade inválida. Valores permitidos: LOW, MEDIUM, HIGH, URGENT.');
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

    // ── Construir dados de actualização ──
    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (title !== undefined) {
      oldValues.title = existingProcess.title;
      updateData.title = title.trim();
      newValues.title = updateData.title;
    }

    if (description !== undefined) {
      oldValues.description = existingProcess.description;
      updateData.description = description?.trim() || null;
      newValues.description = updateData.description;
    }

    if (status !== undefined) {
      oldValues.status = existingProcess.status;
      updateData.status = status.toUpperCase();
      newValues.status = updateData.status;

      // Se estiver a fechar, registar closed_at
      if (status.toUpperCase() === 'CLOSED' && !existingProcess.closed_at) {
        updateData.closed_at = new Date();
        newValues.closed_at = updateData.closed_at;
      }

      // Se estiver a reabrir, limpar closed_at
      if (status.toUpperCase() !== 'CLOSED') {
        updateData.closed_at = null;
        newValues.closed_at = null;
      }
    }

    if (priority !== undefined) {
      oldValues.priority = existingProcess.priority;
      updateData.priority = priority.toUpperCase();
      newValues.priority = updateData.priority;
    }

    if (court !== undefined) {
      oldValues.court = existingProcess.court;
      updateData.court = court?.trim() || null;
      newValues.court = updateData.court;
    }

    if (judge !== undefined) {
      oldValues.judge = existingProcess.judge;
      updateData.judge = judge?.trim() || null;
      newValues.judge = updateData.judge;
    }

    if (opposing_party !== undefined) {
      oldValues.opposing_party = existingProcess.opposing_party;
      updateData.opposing_party = opposing_party?.trim() || null;
      newValues.opposing_party = updateData.opposing_party;
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

    // ── Actualizar processo ──
    const updatedProcess = await db.legalProcess.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta
    const formattedProcess = {
      id: updatedProcess.id,
      process_number: updatedProcess.process_number,
      title: updatedProcess.title,
      description: updatedProcess.description,
      area: updatedProcess.area,
      status: updatedProcess.status,
      priority: updatedProcess.priority,
      court: updatedProcess.court,
      judge: updatedProcess.judge,
      opposing_party: updatedProcess.opposing_party,
      opened_at: updatedProcess.opened_at,
      closed_at: updatedProcess.closed_at,
      created_at: updatedProcess.created_at,
      updated_at: updatedProcess.updated_at,
      client: updatedProcess.client,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PROCESS_UPDATED',
      entity_type: 'LegalProcess',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedProcess });
  } catch (error) {
    console.error('[PROCESSES UPDATE] Erro interno:', error);
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
