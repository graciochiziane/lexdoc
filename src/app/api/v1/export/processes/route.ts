// ═══════════════════════════════════════════════════════════════
// LEXDOC — Exportação CSV de Processos
// GET /api/v1/export/processes?format=csv
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// CSV Helper
// ─────────────────────────────────────────
function escapeCSV(value: string | null | number | boolean): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSVRow(values: Array<string | null | number | boolean>): string {
  return values.map(escapeCSV).join(',');
}

// ─────────────────────────────────────────
// GET: Exportar processos como CSV
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso negado.' },
      },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    let where: Record<string, unknown> = { firm_id: payload.firm_id };
    if (idsParam) {
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    const processes = await db.legalProcess.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        process_number: true,
        title: true,
        description: true,
        area: true,
        status: true,
        priority: true,
        court: true,
        judge: true,
        opposing_party: true,
        opened_at: true,
        closed_at: true,
        client: {
          select: { full_name: true },
        },
      },
    });

    // Gerar CSV
    const lines: string[] = [];

    lines.push(toCSVRow([
      'Nº Processo',
      'Título',
      'Descrição',
      'Área',
      'Estado',
      'Prioridade',
      'Tribunal',
      'Juiz',
      'Parte Contrária',
      'Cliente',
      'Data de Abertura',
      'Data de Encerramento',
    ]));

    for (const p of processes) {
      lines.push(toCSVRow([
        p.process_number,
        p.title,
        p.description,
        p.area,
        p.status,
        p.priority,
        p.court,
        p.judge,
        p.opposing_party,
        p.client.full_name,
        p.opened_at.toISOString(),
        p.closed_at?.toISOString() ?? '',
      ]));
    }

    const csv = lines.join('\n');
    const filename = `processos_lexdoc_${new Date().toISOString().split('T')[0]}.csv`;

    const { logAudit } = await import('@/lib/audit');
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CSV_EXPORT',
      entity_type: 'LegalProcess',
      metadata: { count: processes.length, filename },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT_PROCESSES] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
