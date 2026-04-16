// ═══════════════════════════════════════════════════════════════
// LEXDOC — Processos Jurídicos: Listar e Criar
// GET  /api/v1/processes — Listar processos do escritório
// POST /api/v1/processes — Criar novo processo (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Valores válidos para filtros
// ─────────────────────────────────────────
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED'];
const VALID_AREAS = [
  'CIVIL', 'PENAL', 'TRABALHISTA', 'COMERCIAL', 'FAMILIA',
  'ADMINISTRATIVO', 'TRIBUTARIO', 'CONSTITUCIONAL', 'OUTRO',
];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─────────────────────────────────────────
// GET — Listar processos
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);

    // Filtros opcionais
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.toUpperCase();
    const area = searchParams.get('area')?.toUpperCase();
    const priority = searchParams.get('priority')?.toUpperCase();

    // Validar filtros
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Estado inválido. Valores permitidos: ACTIVE, SUSPENDED, CLOSED, ARCHIVED.',
          },
        },
        { status: 400 }
      );
    }

    if (area && !VALID_AREAS.includes(area)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Área jurídica inválida.' },
        },
        { status: 400 }
      );
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Prioridade inválida. Valores permitidos: LOW, MEDIUM, HIGH, URGENT.',
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (search) {
      (where as Record<string, unknown[]>)['OR'] = [
        { process_number: { contains: search } },
        { title: { contains: search } },
        { opposing_party: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (area) {
      where.area = area;
    }

    if (priority) {
      where.priority = priority;
    }

    // Contar total e buscar registos com dados do cliente
    const [total, processes] = await Promise.all([
      db.legalProcess.count({ where }),
      db.legalProcess.findMany({
        where,
        include: {
          client: {
            select: { id: true, full_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Formatar resposta — não incluir campos desnecessários
    const formattedProcesses = processes.map((p) => ({
      id: p.id,
      process_number: p.process_number,
      title: p.title,
      description: p.description,
      area: p.area,
      status: p.status,
      priority: p.priority,
      court: p.court,
      judge: p.judge,
      opposing_party: p.opposing_party,
      opened_at: p.opened_at,
      closed_at: p.closed_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
      client: p.client,
    }));

    return NextResponse.json({
      success: true,
      data: formattedProcesses,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[PROCESSES LIST] Erro interno:', error);
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
// POST — Criar processo
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem criar processos
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
    const body = await request.json();
    const {
      client_id,
      process_number,
      title,
      description,
      area,
      priority,
      court,
      judge,
      opposing_party,
    } = body as {
      client_id?: string;
      process_number?: string;
      title?: string;
      description?: string;
      area?: string;
      priority?: string;
      court?: string;
      judge?: string;
      opposing_party?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (!client_id || typeof client_id !== 'string') {
      errors.push('ID do cliente é obrigatório.');
    }

    if (!process_number || typeof process_number !== 'string' || process_number.trim().length < 1) {
      errors.push('Número do processo é obrigatório.');
    }

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      errors.push('Título é obrigatório (mínimo 2 caracteres).');
    }

    if (!area || typeof area !== 'string' || !VALID_AREAS.includes(area.toUpperCase())) {
      errors.push(`Área jurídica é obrigatória. Valores: ${VALID_AREAS.join(', ')}`);
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority.toUpperCase())) {
      errors.push(`Prioridade inválida. Valores: ${VALID_PRIORITIES.join(', ')}`);
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

    // ── Verificar se o cliente pertence ao escritório ──
    const client = await db.client.findFirst({
      where: { id: client_id, firm_id: payload.firm_id },
    });

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Cliente não encontrado no escritório.' },
        },
        { status: 404 }
      );
    }

    // ── Verificar unicidade do número do processo no escritório ──
    const existingProcess = await db.legalProcess.findFirst({
      where: {
        firm_id: payload.firm_id,
        process_number: process_number.trim(),
      },
    });

    if (existingProcess) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Já existe um processo com este número no escritório.',
          },
        },
        { status: 409 }
      );
    }

    const processPriority = priority ? priority.toUpperCase() : 'MEDIUM';

    // ── Criar processo ──
    const process = await db.legalProcess.create({
      data: {
        firm_id: payload.firm_id,
        client_id,
        process_number: process_number.trim(),
        title: title.trim(),
        description: description?.trim() || null,
        area: area.toUpperCase(),
        priority: processPriority,
        court: court?.trim() || null,
        judge: judge?.trim() || null,
        opposing_party: opposing_party?.trim() || null,
      },
      include: {
        client: {
          select: { id: true, full_name: true },
        },
      },
    });

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
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PROCESS_CREATED',
      entity_type: 'LegalProcess',
      entity_id: process.id,
      new_values: {
        process_number: process.process_number,
        title: process.title,
        area: process.area,
        client_id,
        client_name: client.full_name,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedProcess }, { status: 201 });
  } catch (error) {
    console.error('[PROCESSES CREATE] Erro interno:', error);
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
