// ═══════════════════════════════════════════════════════════════
// LEXDOC — Base de Conhecimento Jurídico: Listar e Criar
// GET  /api/v1/knowledge — Listar artigos do escritório
// POST /api/v1/knowledge — Criar novo artigo (ADMIN/ADVOGADO)
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
// Valores válidos para categoria
// ─────────────────────────────────────────
const VALID_CATEGORIES = [
  'CONSTITUCIONAL',
  'CIVIL',
  'PENAL',
  'COMERCIAL',
  'TRABALHO',
  'FAMILIA',
  'FISCAL',
  'ADMINISTRATIVO',
  'PROCESSUAL',
  'OUTRO',
];

// ─────────────────────────────────────────
// GET — Listar artigos
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
    const category = searchParams.get('category')?.toUpperCase();

    // Validar categoria
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Categoria inválida. Valores permitidos: ${VALID_CATEGORIES.join(', ')}.`,
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (search) {
      (where as Record<string, unknown[]>)['OR'] = [
        { title: { contains: search } },
        { content: { contains: search } },
        { source: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Contar total e buscar registos
    const [total, articles] = await Promise.all([
      db.knowledgeArticle.count({ where }),
      db.knowledgeArticle.findMany({
        where,
        include: {
          created_by: {
            select: { id: true, full_name: true },
          },
        },
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    // Formatar resposta — não incluir campos desnecessários
    const formattedArticles = articles.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      source: a.source,
      tags: a.tags,
      is_pinned: a.is_pinned,
      view_count: a.view_count,
      created_at: a.created_at,
      updated_at: a.updated_at,
      created_by: a.created_by,
    }));

    return NextResponse.json({
      success: true,
      data: formattedArticles,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[KNOWLEDGE LIST] Erro interno:', error);
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
// POST — Criar artigo
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem criar artigos
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
      content,
      category,
      source,
      tags,
      is_pinned,
    } = body as {
      title?: string;
      content?: string;
      category?: string;
      source?: string;
      tags?: string;
      is_pinned?: boolean;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      errors.push('Título é obrigatório (mínimo 2 caracteres).');
    }

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      errors.push('Conteúdo é obrigatório (mínimo 10 caracteres).');
    }

    if (!category || typeof category !== 'string' || !VALID_CATEGORIES.includes(category.toUpperCase())) {
      errors.push(`Categoria é obrigatória. Valores: ${VALID_CATEGORIES.join(', ')}`);
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

    // Validar tags como JSON válido
    let parsedTags: unknown[] = [];
    if (tags && typeof tags === 'string' && tags.trim().length > 0) {
      try {
        parsedTags = JSON.parse(tags);
        if (!Array.isArray(parsedTags)) {
          parsedTags = [tags.trim()];
        }
      } catch {
        // Se não for JSON válido, tratar como array com um elemento
        parsedTags = [tags.trim()];
      }
    }

    const articleCategory = category!.toUpperCase();

    // ── Criar artigo ──
    const article = await db.knowledgeArticle.create({
      data: {
        firm_id: payload.firm_id,
        title: title!.trim(),
        content: content!.trim(),
        category: articleCategory,
        source: source?.trim() || null,
        tags: JSON.stringify(parsedTags),
        is_pinned: typeof is_pinned === 'boolean' ? is_pinned : false,
        created_by_id: payload.sub,
      },
      include: {
        created_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta
    const formattedArticle = {
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      source: article.source,
      tags: article.tags,
      is_pinned: article.is_pinned,
      view_count: article.view_count,
      created_at: article.created_at,
      updated_at: article.updated_at,
      created_by: article.created_by,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'KNOWLEDGE_CREATED',
      entity_type: 'KnowledgeArticle',
      entity_id: article.id,
      new_values: {
        title: article.title,
        category: article.category,
        source: article.source,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedArticle }, { status: 201 });
  } catch (error) {
    console.error('[KNOWLEDGE CREATE] Erro interno:', error);
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
