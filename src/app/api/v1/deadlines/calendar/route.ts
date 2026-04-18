// ═══════════════════════════════════════════════════════════════
// LEXDOC — Calendário de Prazos
// GET /api/v1/deadlines/calendar?month=2026-04&process_id=xxx
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Prazos do calendário por mês
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  const firmId = payload.firm_id;

  try {
    const { searchParams } = new URL(request.url);

    // Parse month (format: YYYY-MM)
    const monthStr = searchParams.get('month');
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parâmetro "month" obrigatório no formato YYYY-MM.',
          },
        },
        { status: 400 },
      );
    }

    const [yearStr, monthStrPart] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStrPart, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Mês inválido. Use formato YYYY-MM (ex: 2026-04).',
          },
        },
        { status: 400 },
      );
    }

    // Calcular limites do mês
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Filtro opcional por processo
    const processIdFilter = searchParams.get('process_id');

    // Construir cláusula WHERE
    const where: Record<string, unknown> = {
      process: { firm_id: firmId },
      due_date: { gte: startDate, lte: endDate },
    };

    if (processIdFilter) {
      where.process_id = processIdFilter;
    }

    // Buscar prazos do mês com dados do processo
    const deadlines = await db.deadline.findMany({
      where,
      include: {
        process: {
          select: {
            id: true,
            process_number: true,
            title: true,
          },
        },
      },
      orderBy: { due_date: 'asc' },
    });

    // Agrupar por data (YYYY-MM-DD)
    const grouped: Record<string, Array<{
      id: string;
      title: string;
      due_date: string;
      status: string;
      process_id: string;
      process_title: string;
      process_number: string;
    }>> = {};

    for (const d of deadlines) {
      const dateKey = d.due_date.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({
        id: d.id,
        title: d.title,
        due_date: d.due_date.toISOString(),
        status: d.status,
        process_id: d.process_id,
        process_title: d.process.title,
        process_number: d.process.process_number,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        deadlines_by_date: grouped,
        total: deadlines.length,
      },
    });
  } catch (error) {
    console.error('[CALENDAR DEADLINES] Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor. Tente novamente mais tarde.',
        },
      },
      { status: 500 },
    );
  }
}
