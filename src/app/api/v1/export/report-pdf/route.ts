// ═══════════════════════════════════════════════════════════════
// LEXDOC — Exportação de Relatório em HTML para Impressão/PDF
// GET /api/v1/export/report-pdf?type=firm_overview|processes|clients|deadlines
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos válidos de relatório
// ─────────────────────────────────────────
const VALID_TYPES = ['firm_overview', 'processes', 'clients', 'deadlines'] as const;
type ReportType = (typeof VALID_TYPES)[number];

const TYPE_LABELS: Record<ReportType, string> = {
  firm_overview: 'Visão Geral do Escritório',
  processes: 'Relatório de Processos',
  clients: 'Relatório de Clientes',
  deadlines: 'Relatório de Prazos',
};

// ─────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-MZ', {
    timeZone: 'Africa/Maputo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-MZ', {
    timeZone: 'Africa/Maputo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nowFormatted(): string {
  return new Date().toLocaleDateString('pt-MZ', {
    timeZone: 'Africa/Maputo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────
// Gerar HTML base com estilos de impressão
// ─────────────────────────────────────────
function buildHtmlShell(title: string, firmName: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-MZ">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — LexDoc</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a1a2e;
      background: #fff;
      padding: 40px;
      font-size: 13px;
      line-height: 1.6;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 15mm; size: A4; }
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #10b981;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #10b981, #14b8a6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
    }
    .header-logo-text {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
    }
    .header-logo-text span { color: #10b981; }
    .header-date {
      text-align: right;
      color: #6b7280;
      font-size: 12px;
    }
    .header-date strong {
      display: block;
      font-size: 14px;
      color: #374151;
    }
    .report-title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      width: 4px;
      height: 16px;
      background: #10b981;
      border-radius: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    thead th {
      background: #f0fdf4;
      color: #065f46;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid #d1fae5;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    tbody td {
      padding: 8px 12px;
      border: 1px solid #e5e7eb;
    }
    tbody tr:nth-child(even) { background: #f9fafb; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-suspended { background: #fef3c7; color: #92400e; }
    .badge-closed { background: #f3f4f6; color: #374151; }
    .badge-overdue { background: #fee2e2; color: #991b1b; }
    .badge-upcoming { background: #fef3c7; color: #92400e; }
    .badge-completed { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #dbeafe; color: #1e40af; }
    .badge-urgent { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #f3f4f6; color: #374151; }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card-value {
      font-size: 28px;
      font-weight: 700;
      color: #10b981;
    }
    .stat-card-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16,185,129,0.3);
    }
    .print-btn:hover { background: #059669; }
    .empty-text {
      text-align: center;
      color: #9ca3af;
      padding: 32px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <div class="header">
    <div class="header-logo">
      <div class="header-logo-icon">LD</div>
      <div class="header-logo-text"><span>lex</span>Doc</div>
    </div>
    <div class="header-date">
      <strong>${escapeHtml(firmName)}</strong>
      ${nowFormatted()}
    </div>
  </div>
  ${body}
  <div class="footer">
    Relatório gerado automaticamente pelo LexDoc — Plataforma de Gestão Documental Jurídica &copy; ${new Date().getFullYear()}<br />
    Documento confidencial — Uso interno apenas
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────
// Relatório: Visão Geral do Escritório
// ─────────────────────────────────────────
async function generateFirmOverview(firmId: string, firmName: string): Promise<string> {
  const [
    processCount,
    activeCount,
    clientCount,
    documentCount,
    overdueCount,
    upcomingCount,
    completedCount,
    recentProcesses,
    activeUsers,
  ] = await Promise.all([
    db.legalProcess.count({ where: { firm_id: firmId } }),
    db.legalProcess.count({ where: { firm_id: firmId, status: 'ACTIVE' } }),
    db.client.count({ where: { firm_id: firmId, is_active: true } }),
    db.document.count({ where: { firm_id: firmId, status: 'FINAL' } }),
    db.deadline.count({ where: { firm_id: firmId, status: 'PENDING', due_date: { lt: new Date() } } }),
    db.deadline.count({ where: { firm_id: firmId, status: 'PENDING', due_date: { gte: new Date() } } }),
    db.deadline.count({ where: { firm_id: firmId, status: 'COMPLETED' } }),
    db.legalProcess.findMany({
      where: { firm_id: firmId },
      orderBy: { updated_at: 'desc' },
      take: 10,
      select: { process_number: true, title: true, status: true, priority: true, area: true, updated_at: true, client: { select: { full_name: true } } },
    }),
    db.user.count({ where: { firm_id: firmId, is_active: true } }),
  ]);

  const title = TYPE_LABELS.firm_overview;
  const body = `
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <p class="report-subtitle">Resumo executivo do escritório ${escapeHtml(firmName)}</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-value">${processCount}</div>
        <div class="stat-card-label">Total de Processos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${activeCount}</div>
        <div class="stat-card-label">Processos Activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${clientCount}</div>
        <div class="stat-card-label">Clientes Activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${documentCount}</div>
        <div class="stat-card-label">Documentos Finais</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${overdueCount}</div>
        <div class="stat-card-label">Prazos Expirados</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${activeUsers}</div>
        <div class="stat-card-label">Utilizadores Activos</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Processos Recentes</div>
      ${recentProcesses.length === 0 ? '<p class="empty-text">Nenhum processo registado.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Nº Processo</th>
            <th>Título</th>
            <th>Cliente</th>
            <th>Área</th>
            <th>Prioridade</th>
            <th>Estado</th>
            <th>Actualizado</th>
          </tr>
        </thead>
        <tbody>
          ${recentProcesses.map((p) => `
          <tr>
            <td><strong>${escapeHtml(p.process_number)}</strong></td>
            <td>${escapeHtml(p.title)}</td>
            <td>${escapeHtml(p.client?.full_name ?? '—')}</td>
            <td>${escapeHtml(p.area)}</td>
            <td><span class="badge badge-${(p.priority ?? 'medium').toLowerCase()}">${escapeHtml(p.priority ?? '—')}</span></td>
            <td><span class="badge badge-${(p.status ?? 'active').toLowerCase()}">${escapeHtml(p.status === 'ACTIVE' ? 'Activo' : p.status === 'SUSPENDED' ? 'Suspenso' : p.status === 'CLOSED' ? 'Encerrado' : p.status)}</span></td>
            <td>${formatDate(p.updated_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>

    <div class="section">
      <div class="section-title">Resumo de Prazos</div>
      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card">
          <div class="stat-card-value" style="color: #ef4444;">${overdueCount}</div>
          <div class="stat-card-label">Expirados</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value" style="color: #f59e0b;">${upcomingCount}</div>
          <div class="stat-card-label">Próximos</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${completedCount}</div>
          <div class="stat-card-label">Concluídos</div>
        </div>
      </div>
    </div>
  `;

  return buildHtmlShell(title, firmName, body);
}

// ─────────────────────────────────────────
// Relatório: Processos
// ─────────────────────────────────────────
async function generateProcessesReport(firmId: string, firmName: string): Promise<string> {
  const processes = await db.legalProcess.findMany({
    where: { firm_id: firmId },
    orderBy: { updated_at: 'desc' },
    select: {
      process_number: true,
      title: true,
      status: true,
      priority: true,
      area: true,
      court: true,
      judge: true,
      opposing_party: true,
      opened_at: true,
      closed_at: true,
      updated_at: true,
      client: { select: { full_name: true } },
    },
  });

  const statusLabel = (s: string) => s === 'ACTIVE' ? 'Activo' : s === 'SUSPENDED' ? 'Suspenso' : s === 'CLOSED' ? 'Encerrado' : s;
  const priorityLabel = (p: string) => p === 'URGENT' ? 'Urgente' : p === 'HIGH' ? 'Alta' : p === 'MEDIUM' ? 'Média' : p === 'LOW' ? 'Baixa' : p;

  const title = TYPE_LABELS.processes;
  const body = `
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <p class="report-subtitle">Todos os processos do escritório — Total: ${processes.length}</p>

    <div class="section">
      <div class="section-title">Lista de Processos</div>
      ${processes.length === 0 ? '<p class="empty-text">Nenhum processo registado.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Nº Processo</th>
            <th>Título</th>
            <th>Cliente</th>
            <th>Área</th>
            <th>Prioridade</th>
            <th>Estado</th>
            <th>Tribunal</th>
            <th>Data Abertura</th>
            <th>Actualizado</th>
          </tr>
        </thead>
        <tbody>
          ${processes.map((p) => `
          <tr>
            <td><strong>${escapeHtml(p.process_number)}</strong></td>
            <td>${escapeHtml(p.title)}</td>
            <td>${escapeHtml(p.client?.full_name ?? '—')}</td>
            <td>${escapeHtml(p.area ?? '—')}</td>
            <td><span class="badge badge-${(p.priority ?? 'medium').toLowerCase()}">${escapeHtml(priorityLabel(p.priority ?? ''))}</span></td>
            <td><span class="badge badge-${(p.status ?? 'active').toLowerCase()}">${escapeHtml(statusLabel(p.status))}</span></td>
            <td>${escapeHtml(p.court ?? '—')}</td>
            <td>${formatDate(p.opened_at)}</td>
            <td>${formatDate(p.updated_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>
  `;

  return buildHtmlShell(title, firmName, body);
}

// ─────────────────────────────────────────
// Relatório: Clientes
// ─────────────────────────────────────────
async function generateClientsReport(firmId: string, firmName: string): Promise<string> {
  const clients = await db.client.findMany({
    where: { firm_id: firmId },
    orderBy: { created_at: 'desc' },
    select: {
      full_name: true,
      email: true,
      phone: true,
      address: true,
      client_type: true,
      is_active: true,
      created_at: true,
    },
  });

  const typeLabel = (t: string) => t === 'INDIVIDUAL' ? 'Individual' : t === 'EMPRESA' ? 'Empresa' : t === 'GOVERNO' ? 'Governo' : t === 'ONG' ? 'ONG' : t;

  const title = TYPE_LABELS.clients;
  const body = `
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <p class="report-subtitle">Todos os clientes do escritório — Total: ${clients.length}</p>

    <div class="section">
      <div class="section-title">Lista de Clientes</div>
      ${clients.length === 0 ? '<p class="empty-text">Nenhum cliente registado.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Nome Completo</th>
            <th>Email</th>
            <th>Telefone</th>
            <th>Endereço</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Registado em</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map((c) => `
          <tr>
            <td><strong>${escapeHtml(c.full_name)}</strong></td>
            <td>${escapeHtml(c.email)}</td>
            <td>${escapeHtml(c.phone)}</td>
            <td>${escapeHtml(c.address)}</td>
            <td>${escapeHtml(typeLabel(c.client_type))}</td>
            <td>${c.is_active ? '<span class="badge badge-active">Activo</span>' : '<span class="badge badge-closed">Inactivo</span>'}</td>
            <td>${formatDate(c.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>
  `;

  return buildHtmlShell(title, firmName, body);
}

// ─────────────────────────────────────────
// Relatório: Prazos
// ─────────────────────────────────────────
async function generateDeadlinesReport(firmId: string, firmName: string): Promise<string> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [allDeadlines, overdueCount, dueSoonCount, completedCount] = await Promise.all([
    db.deadline.findMany({
      where: { firm_id: firmId },
      orderBy: { due_date: 'asc' },
      select: {
        title: true,
        description: true,
        due_date: true,
        status: true,
        created_at: true,
        process: { select: { process_number: true, title: true } },
      },
    }),
    db.deadline.count({ where: { firm_id: firmId, status: 'PENDING', due_date: { lt: now } } }),
    db.deadline.count({ where: { firm_id: firmId, status: 'PENDING', due_date: { gte: now, lte: threeDaysFromNow } } }),
    db.deadline.count({ where: { firm_id: firmId, status: 'COMPLETED' } }),
  ]);

  const statusLabel = (s: string) => s === 'PENDING' ? 'Pendente' : s === 'COMPLETED' ? 'Concluído' : s === 'CANCELLED' ? 'Cancelado' : s;
  const statusBadge = (s: string, dd: Date) => {
    if (s === 'COMPLETED') return 'completed';
    if (dd < now) return 'overdue';
    if (dd <= threeDaysFromNow) return 'upcoming';
    return 'pending';
  };

  const title = TYPE_LABELS.deadlines;
  const body = `
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <p class="report-subtitle">Todos os prazos do escritório — Total: ${allDeadlines.length}</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-value" style="color: #ef4444;">${overdueCount}</div>
        <div class="stat-card-label">Expirados</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value" style="color: #f59e0b;">${dueSoonCount}</div>
        <div class="stat-card-label">A expirar em 3 dias</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${completedCount}</div>
        <div class="stat-card-label">Concluídos</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Lista de Prazos</div>
      ${allDeadlines.length === 0 ? '<p class="empty-text">Nenhum prazo registado.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Processo</th>
            <th>Data Limite</th>
            <th>Estado</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          ${allDeadlines.map((d) => `
          <tr>
            <td><strong>${escapeHtml(d.title)}</strong></td>
            <td>${escapeHtml(d.process?.process_number ?? '—')} — ${escapeHtml(d.process?.title ?? '—')}</td>
            <td>${formatDate(d.due_date)}</td>
            <td><span class="badge badge-${statusBadge(d.status, new Date(d.due_date))}">${escapeHtml(statusLabel(d.status))}</span></td>
            <td>${escapeHtml(d.description)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>
  `;

  return buildHtmlShell(title, firmName, body);
}

// ─────────────────────────────────────────
// GET: Exportar relatório em HTML
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
    // Validar tipo de relatório
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') as ReportType | null;

    if (!reportType || !VALID_TYPES.includes(reportType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Tipo de relatório inválido. Valores aceites: ${VALID_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    // Buscar nome do escritório
    const firm = await db.firm.findUnique({
      where: { id: payload.firm_id },
      select: { name: true },
    });
    const firmName = firm?.name ?? 'Escritório';

    // Gerar relatório
    let html: string;
    switch (reportType) {
      case 'firm_overview':
        html = await generateFirmOverview(payload.firm_id, firmName);
        break;
      case 'processes':
        html = await generateProcessesReport(payload.firm_id, firmName);
        break;
      case 'clients':
        html = await generateClientsReport(payload.firm_id, firmName);
        break;
      case 'deadlines':
        html = await generateDeadlinesReport(payload.firm_id, firmName);
        break;
    }

    const filename = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.html`;

    // Log de auditoria
    const { logAudit } = await import('@/lib/audit');
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PDF_EXPORT',
      entity_type: 'Report',
      metadata: { type: reportType, filename },
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT_REPORT_PDF] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
