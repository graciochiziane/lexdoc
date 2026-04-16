// ═══════════════════════════════════════════════════════════════
// LEXDOC — Processos Jurídicos: Alterar Estado via Kanban
// PATCH /api/v1/processes/:id/status — Alterar estado do processo
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Estados válidos para Kanban
// ─────────────────────────────────────────
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'APPEAL', 'CLOSED'];

const STATUS_ACTION_MAP: Record<string, string> = {
  ACTIVE: 'PROCESS_REACTIVATED',
  SUSPENDED: 'PROCESS_SUSPENDED',
  APPEAL: 'PROCESS_APPEALED',
  CLOSED: 'PROCESS_CLOSED',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspenso',
  APPEAL: 'Recurso',
  CLOSED: 'Encerrado',
};

// ─────────────────────────────────────────
// PATCH — Alterar estado do processo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem alterar estado
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
      include: {
        client: {
          select: { id: true, full_name: true },
        },
      },
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
    const { status } = body as { status?: string };

    // Validação do estado
    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Estado inválido. Valores permitidos: ACTIVE, SUSPENDED, APPEAL, CLOSED.',
          },
        },
        { status: 400 }
      );
    }

    const newStatus = status.toUpperCase();

    // Verificar se o estado é o mesmo
    if (existingProcess.status === newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `O processo já se encontra no estado "${STATUS_LABELS[newStatus]}".`,
          },
        },
        { status: 409 }
      );
    }

    // Construir dados de actualização
    const oldStatus = existingProcess.status;
    const updateData: Record<string, unknown> = { status: newStatus };

    // Se estiver a fechar, registar closed_at
    if (newStatus === 'CLOSED' && !existingProcess.closed_at) {
      updateData.closed_at = new Date();
    }

    // Se estiver a reabrir, limpar closed_at
    if (newStatus !== 'CLOSED') {
      updateData.closed_at = null;
    }

    // Actualizar processo
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

    // Log de auditoria
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: STATUS_ACTION_MAP[newStatus] ?? 'STATUS_CHANGED',
      entity_type: 'LegalProcess',
      entity_id: id,
      old_values: {
        status: oldStatus,
        process_number: updatedProcess.process_number,
      },
      new_values: {
        status: newStatus,
        process_number: updatedProcess.process_number,
        closed_at: updateData.closed_at ?? null,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedProcess });
  } catch (error) {
    console.error('[PROCESSES STATUS] Erro interno:', error);
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
