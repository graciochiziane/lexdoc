// ═══════════════════════════════════════════════════════════════
// LEXDOC — Prazos Processuais: Listar e Criar
// GET  /api/v1/deadlines — Listar prazos do escritório
// POST /api/v1/deadlines — Criar novo prazo (ADMIN/ADVOGADO)
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
const VALID_STATUSES = ['PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED'];
const VALID_SOURCES = ['MANUAL', 'AI_EXTRACTED', 'CALENDAR_SYNC'];

// ─────────────────────────────────────────
// GET — Listar prazos
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
    const processId = searchParams.get('process_id')?.trim() || '';

    // Validar filtro de estado
    if (status && !VALID_STATUSES.includes(status)) {
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

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id via processo
    const where: Record<string, unknown> = {
      process: { firm_id: payload.firm_id },
    };

    if (search) {
      where.title = { contains: search };
    }

    if (status) {
      where.status = status;
    }

    if (processId) {
      where.process_id = processId;
    }

    // Contar total e buscar registos
    const [total, deadlines] = await Promise.all([
      db.deadline.count({ where }),
      db.deadline.findMany({
        where,
        include: {
          process: {
            select: {
              id: true,
              title: true,
              process_number: true,
            },
          },
        },
        orderBy: { due_date: 'asc' },
        skip,
        take: limit,
      }),
    ]);

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
      process: d.process,
    }));

    return NextResponse.json({
      success: true,
      data: formattedDeadlines,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[DEADLINES LIST] Erro interno:', error);
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
// POST — Criar prazo
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem criar prazos
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
      process_id,
      title,
      description,
      due_date,
      reminder_at,
      source,
    } = body as {
      process_id?: string;
      title?: string;
      description?: string;
      due_date?: string;
      reminder_at?: string;
      source?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (!process_id || typeof process_id !== 'string') {
      errors.push('ID do processo é obrigatório.');
    }

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      errors.push('Título é obrigatório (mínimo 2 caracteres).');
    }

    if (!due_date || typeof due_date !== 'string') {
      errors.push('Data limite é obrigatória.');
    } else {
      const parsedDate = new Date(due_date);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Data limite inválida.');
      }
    }

    if (source && !VALID_SOURCES.includes(source.toUpperCase())) {
      errors.push('Fonte inválida. Valores permitidos: MANUAL, AI_EXTRACTED, CALENDAR_SYNC.');
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

    // ── Verificar se o processo pertence ao escritório ──
    const process = await db.legalProcess.findFirst({
      where: { id: process_id, firm_id: payload.firm_id },
    });

    if (!process) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Processo não encontrado no escritório.' },
        },
        { status: 404 }
      );
    }

    // ── Criar prazo ──
    const deadlineSource = source ? source.toUpperCase() : 'MANUAL';

    const deadline = await db.deadline.create({
      data: {
        process_id,
        title: title.trim(),
        description: description?.trim() || null,
        due_date: new Date(due_date),
        reminder_at: reminder_at ? new Date(reminder_at) : null,
        source: deadlineSource,
        ai_extracted: deadlineSource === 'AI_EXTRACTED',
      },
    });

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
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'DEADLINE_CREATED',
      entity_type: 'Deadline',
      entity_id: deadline.id,
      new_values: {
        title: deadline.title,
        due_date: deadline.due_date,
        process_id,
        process_title: process.title,
        source: deadlineSource,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedDeadline }, { status: 201 });
  } catch (error) {
    console.error('[DEADLINES CREATE] Erro interno:', error);
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
