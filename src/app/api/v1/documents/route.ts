// ═══════════════════════════════════════════════════════════════
// LEXDOC — Documentos: Listar e Criar (Metadados)
// GET  /api/v1/documents — Listar documentos do escritório
// POST /api/v1/documents — Criar metadados de documento (ADMIN/ADVOGADO)
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
const VALID_STATUSES = ['DRAFT', 'FINAL', 'SIGNED', 'ARCHIVED'];

// ─────────────────────────────────────────
// GET — Listar documentos
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
    const tagsParam = searchParams.get('tags')?.trim() || '';

    // Validar filtro de estado
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Estado inválido. Valores permitidos: DRAFT, FINAL, SIGNED, ARCHIVED.',
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (search) {
      where.title = { contains: search };
    }

    if (status) {
      where.status = status;
    }

    if (processId) {
      where.process_id = processId;
    }

    if (tagsParam) {
      // Pesquisar tags — o campo tags é JSON serializado
      where.tags = { contains: tagsParam };
    }

    // Contar total e buscar registos — NUNCA retornar file_key
    const [total, documents] = await Promise.all([
      db.document.count({ where }),
      db.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          file_name: true,
          file_size: true,
          mime_type: true,
          version: true,
          status: true,
          is_confidential: true,
          tags: true,
          created_at: true,
          updated_at: true,
          process_id: true,
          created_by: {
            select: { id: true, full_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Formatar resposta
    const formattedDocuments = documents.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      version: d.version,
      status: d.status,
      is_confidential: d.is_confidential,
      tags: d.tags,
      created_at: d.created_at,
      updated_at: d.updated_at,
      process_id: d.process_id,
      created_by: d.created_by,
    }));

    return NextResponse.json({
      success: true,
      data: formattedDocuments,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[DOCUMENTS LIST] Erro interno:', error);
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
// POST — Criar metadados de documento
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem criar documentos
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
      title,
      file_name,
      file_size,
      mime_type,
      process_id,
      description,
      tags,
      status,
    } = body as {
      title?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
      process_id?: string;
      description?: string;
      tags?: string;
      status?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      errors.push('Título é obrigatório (mínimo 2 caracteres).');
    }

    if (!file_name || typeof file_name !== 'string' || file_name.trim().length < 1) {
      errors.push('Nome do ficheiro é obrigatório.');
    }

    if (file_size === undefined || typeof file_size !== 'number' || file_size < 0) {
      errors.push('Tamanho do ficheiro é obrigatório (número >= 0).');
    }

    if (!mime_type || typeof mime_type !== 'string' || mime_type.trim().length < 1) {
      errors.push('Tipo MIME é obrigatório.');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push('Estado inválido. Valores permitidos: DRAFT, FINAL, SIGNED, ARCHIVED.');
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

    // ── Verificar se o processo pertence ao escritório (se fornecido) ──
    if (process_id) {
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
    }

    // ── Validar tags como JSON array ──
    let parsedTags: string[] = [];
    if (tags) {
      try {
        const rawParsed = JSON.parse(tags);
        if (!Array.isArray(rawParsed) || !rawParsed.every((t: unknown) => typeof t === 'string')) {
          errors.push('Tags devem ser um array JSON de strings.');
        } else {
          parsedTags = rawParsed;
        }
      } catch {
        errors.push('Tags devem ser um JSON válido (array de strings).');
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
    }

    // Chave temporária — ficheiro será enviado em fase posterior
    const placeholderKey = `pending://${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const documentStatus = status ? status.toUpperCase() : 'DRAFT';

    // ── Criar documento ──
    const document = await db.document.create({
      data: {
        firm_id: payload.firm_id,
        process_id: process_id || null,
        created_by_id: payload.sub,
        title: title.trim(),
        description: description?.trim() || null,
        file_key: placeholderKey,
        file_name: file_name.trim(),
        file_size,
        mime_type: mime_type.trim(),
        version: 1,
        status: documentStatus,
        is_confidential: false,
        tags: JSON.stringify(parsedTags),
      },
      select: {
        id: true,
        title: true,
        description: true,
        file_name: true,
        file_size: true,
        mime_type: true,
        version: true,
        status: true,
        is_confidential: true,
        tags: true,
        created_at: true,
        updated_at: true,
        process_id: true,
        created_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta
    const formattedDocument = {
      id: document.id,
      title: document.title,
      description: document.description,
      file_name: document.file_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      version: document.version,
      status: document.status,
      is_confidential: document.is_confidential,
      tags: document.tags,
      created_at: document.created_at,
      updated_at: document.updated_at,
      process_id: document.process_id,
      created_by: document.created_by,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'DOCUMENT_CREATED',
      entity_type: 'Document',
      entity_id: document.id,
      new_values: {
        title: document.title,
        file_name: document.file_name,
        mime_type: document.mime_type,
        status: documentStatus,
        process_id: process_id || null,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedDocument }, { status: 201 });
  } catch (error) {
    console.error('[DOCUMENTS CREATE] Erro interno:', error);
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
