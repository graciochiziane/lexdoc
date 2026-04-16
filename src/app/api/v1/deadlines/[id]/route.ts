// ═══════════════════════════════════════════════════════════════
// LEXDOC — Prazos Processuais: Obter e Actualizar por ID
// GET   /api/v1/deadlines/:id — Obter prazo com detalhes
// PATCH /api/v1/deadlines/:id — Actualizar prazo (ADMIN/ADVOGADO)
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
const VALID_STATUSES = ['PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED'];

// ─────────────────────────────────────────
// GET — Obter prazo por ID
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

    // Buscar prazo — verificar firm_id via processo
    const deadline = await db.deadline.findFirst({
      where: { id, process: { firm_id: payload.firm_id } },
      include: {
        process: {
          select: {
            id: true,
            title: true,
            process_number: true,
          },
        },
      },
    });

    if (!deadline) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Prazo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Formatar resposta
    const formattedDeadline = {
      id: deadline.id,
      process_id: deadline.process_id,
      title: deadline.title,
      description: deadline.description,
      due_date: deadline.due_date,
      reminder_at: deadline.reminder_at,
      status: deadline.status,
      source: deadline.source,
      ai_extracted: deadline.ai_extracted,
      created_at: deadline.created_at,
      updated_at: deadline.updated_at,
      process: deadline.process,
    };

    return NextResponse.json({ success: true, data: formattedDeadline });
  } catch (error) {
    console.error('[DEADLINES GET] Erro interno:', error);
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
// PATCH — Actualizar prazo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar prazos
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

    // Verificar se o prazo existe e pertence ao escritório via processo
    const existingDeadline = await db.deadline.findFirst({
      where: { id, process: { firm_id: payload.firm_id } },
      include: {
        process: {
          select: { id: true, title: true, process_number: true },
        },
      },
    });

    if (!existingDeadline) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Prazo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { title, description, due_date, reminder_at, status } = body as {
      title?: string;
      description?: string;
      due_date?: string;
      reminder_at?: string;
      status?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
      errors.push('Título deve ter no mínimo 2 caracteres.');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push('Estado inválido. Valores permitidos: PENDING, COMPLETED, OVERDUE, CANCELLED.');
    }

    if (due_date !== undefined) {
      const parsedDate = new Date(due_date);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Data limite inválida.');
      }
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
      oldValues.title = existingDeadline.title;
      updateData.title = title.trim();
      newValues.title = updateData.title;
    }

    if (description !== undefined) {
      oldValues.description = existingDeadline.description;
      updateData.description = description?.trim() || null;
      newValues.description = updateData.description;
    }

    if (due_date !== undefined) {
      oldValues.due_date = existingDeadline.due_date;
      updateData.due_date = new Date(due_date);
      newValues.due_date = updateData.due_date;
    }

    if (reminder_at !== undefined) {
      oldValues.reminder_at = existingDeadline.reminder_at;
      updateData.reminder_at = reminder_at ? new Date(reminder_at) : null;
      newValues.reminder_at = updateData.reminder_at;
    }

    if (status !== undefined) {
      oldValues.status = existingDeadline.status;
      const newStatus = status.toUpperCase();
      updateData.status = newStatus;
      newValues.status = newStatus;
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

    // ── Actualizar prazo ──
    const updatedDeadline = await db.deadline.update({
      where: { id },
      data: updateData,
      include: {
        process: {
          select: { id: true, title: true, process_number: true },
        },
      },
    });

    // Formatar resposta
    const formattedDeadline = {
      id: updatedDeadline.id,
      process_id: updatedDeadline.process_id,
      title: updatedDeadline.title,
      description: updatedDeadline.description,
      due_date: updatedDeadline.due_date,
      reminder_at: updatedDeadline.reminder_at,
      status: updatedDeadline.status,
      source: updatedDeadline.source,
      ai_extracted: updatedDeadline.ai_extracted,
      created_at: updatedDeadline.created_at,
      updated_at: updatedDeadline.updated_at,
      process: updatedDeadline.process,
    };

    // ── Log de auditoria — actualização geral ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'DEADLINE_UPDATED',
      entity_type: 'Deadline',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    // ── Log adicional se o prazo foi concluído ──
    if (status !== undefined && status.toUpperCase() === 'COMPLETED') {
      logAudit({
        firm_id: payload.firm_id,
        user_id: payload.sub,
        action: 'DEADLINE_COMPLETED',
        entity_type: 'Deadline',
        entity_id: id,
        new_values: {
          title: updatedDeadline.title,
          due_date: updatedDeadline.due_date,
          process_id: updatedDeadline.process_id,
          process_title: updatedDeadline.process.title,
        },
        ip_address: req.headers.get('x-forwarded-for') ?? undefined,
        user_agent: req.headers.get('user-agent') ?? undefined,
      });
    }

    return NextResponse.json({ success: true, data: formattedDeadline });
  } catch (error) {
    console.error('[DEADLINES UPDATE] Erro interno:', error);
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
