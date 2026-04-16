// ═══════════════════════════════════════════════════════════════
// LEXDOC — Processos Jurídicos: Fechar Processo
// PATCH /api/v1/processes/:id/close — Fechar processo (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// PATCH — Fechar processo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem fechar processos
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

    // Verificar se já está fechado
    if (existingProcess.status === 'CLOSED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Processo já se encontra fechado.',
          },
        },
        { status: 409 }
      );
    }

    // ── Fechar processo ──
    const closedProcess = await db.legalProcess.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closed_at: new Date(),
      },
      include: {
        client: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta
    const formattedProcess = {
      id: closedProcess.id,
      process_number: closedProcess.process_number,
      title: closedProcess.title,
      description: closedProcess.description,
      area: closedProcess.area,
      status: closedProcess.status,
      priority: closedProcess.priority,
      court: closedProcess.court,
      judge: closedProcess.judge,
      opposing_party: closedProcess.opposing_party,
      opened_at: closedProcess.opened_at,
      closed_at: closedProcess.closed_at,
      created_at: closedProcess.created_at,
      updated_at: closedProcess.updated_at,
      client: closedProcess.client,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PROCESS_CLOSED',
      entity_type: 'LegalProcess',
      entity_id: id,
      old_values: {
        status: existingProcess.status,
        closed_at: existingProcess.closed_at,
      },
      new_values: {
        status: 'CLOSED',
        closed_at: closedProcess.closed_at,
        process_number: closedProcess.process_number,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedProcess });
  } catch (error) {
    console.error('[PROCESSES CLOSE] Erro interno:', error);
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
