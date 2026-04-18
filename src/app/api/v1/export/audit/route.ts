// ═══════════════════════════════════════════════════════════════
// LEXDOC — Exportação CSV de Registos de Auditoria
// GET /api/v1/export/audit?format=csv
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
// GET: Exportar registos de auditoria como CSV
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
    const logs = await db.auditLog.findMany({
      where: { firm_id: payload.firm_id },
      orderBy: { created_at: 'desc' },
      select: {
        action: true,
        entity_type: true,
        entity_id: true,
        created_at: true,
        ip_address: true,
        user_agent: true,
        user: {
          select: { full_name: true, email: true },
        },
      },
    });

    // Gerar CSV
    const lines: string[] = [];

    lines.push(toCSVRow([
      'Data/Hora',
      'Acção',
      'Entidade',
      'ID da Entidade',
      'Utilizador',
      'Email',
      'Endereço IP',
      'User Agent',
    ]));

    for (const log of logs) {
      lines.push(toCSVRow([
        log.created_at.toISOString(),
        log.action,
        log.entity_type,
        log.entity_id,
        log.user?.full_name ?? 'Sistema',
        log.user?.email ?? '—',
        log.ip_address,
        log.user_agent,
      ]));
    }

    const csv = lines.join('\n');
    const filename = `auditoria_lexdoc_${new Date().toISOString().split('T')[0]}.csv`;

    const { logAudit } = await import('@/lib/audit');
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CSV_EXPORT',
      entity_type: 'AuditLog',
      metadata: { count: logs.length, filename },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT_AUDIT] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
