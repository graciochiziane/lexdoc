// ═══════════════════════════════════════════════════════════════
// LEXDOC — Exportação CSV de Clientes
// GET /api/v1/export/clients?format=csv
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
// GET: Exportar clientes como CSV
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  // Apenas ADMIN e ADVOGADO podem exportar
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

    const clients = await db.client.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        full_name: true,
        email: true,
        phone: true,
        address: true,
        client_type: true,
        is_active: true,
        notes: true,
        created_at: true,
      },
    });

    // Gerar CSV
    const lines: string[] = [];

    // Cabeçalho
    lines.push(toCSVRow([
      'Nome Completo',
      'Email',
      'Telefone',
      'Endereço',
      'Tipo de Cliente',
      'Estado',
      'Notas',
      'Data de Criação',
    ]));

    // Dados
    for (const client of clients) {
      lines.push(toCSVRow([
        client.full_name,
        client.email,
        client.phone,
        client.address,
        client.client_type,
        client.is_active ? 'Activo' : 'Inactivo',
        client.notes,
        client.created_at.toISOString(),
      ]));
    }

    const csv = lines.join('\n');
    const filename = `clientes_lexdoc_${new Date().toISOString().split('T')[0]}.csv`;

    // Log de auditoria
    const { logAudit } = await import('@/lib/audit');
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CSV_EXPORT',
      entity_type: 'Client',
      metadata: { count: clients.length, filename },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT_CLIENTS] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
