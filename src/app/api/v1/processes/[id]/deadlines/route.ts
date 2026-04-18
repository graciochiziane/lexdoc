// ═══════════════════════════════════════════════════════════════
// LEXDOC — Prazos por Processo
// GET /api/v1/processes/:id/deadlines — Listar prazos de um processo
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Valores válidos para filtros
// ─────────────────────────────────────────
const VALID_STATUSES = ['PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED'];

// ─────────────────────────────────────────
// GET — Listar prazos de um processo
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

    // Verificar se o processo pertence ao escritório
    const process = await db.legalProcess.findFirst({
      where: { id, firm_id: payload.firm_id },
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

    // Filtro opcional por estado
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status')?.toUpperCase();

    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Estado inválido. Valores permitidos: PENDING, COMPLETED, OVERDUE, CANCELLED.',
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE
    const where: Record<string, unknown> = { process_id: id };

    if (statusFilter) {
      where.status = statusFilter;
    }

    // Buscar prazos ordenados por data limite ascendente
    const deadlines = await db.deadline.findMany({
      where,
      orderBy: { due_date: 'asc' },
    });

    // Formatar resposta
    const formattedDeadlines = deadlines.map((d) => ({
      id: d.id,
      process_id: d.process_id,
      title: d.title,
      description: d.description,
      due_date: d.due_date,
      reminder_at: d.reminder_at,
      status: d.status,
      source: d.source,
      ai_extracted: d.ai_extracted,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    return NextResponse.json({ success: true, data: formattedDeadlines });
  } catch (error) {
    console.error('[PROCESS DEADLINES LIST] Erro interno:', error);
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
