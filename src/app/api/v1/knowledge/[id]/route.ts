// ═══════════════════════════════════════════════════════════════
// LEXDOC — Base de Conhecimento Jurídico: Obter, Actualizar e Eliminar por ID
// GET    /api/v1/knowledge/:id — Obter artigo (incrementa view_count)
// PATCH  /api/v1/knowledge/:id — Actualizar artigo (ADMIN/ADVOGADO)
// DELETE /api/v1/knowledge/:id — Eliminar artigo (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Valores válidos
// ─────────────────────────────────────────
const VALID_CATEGORIES = [
  'CONSTITUCIONAL', 'CIVIL', 'PENAL', 'COMERCIAL', 'TRABALHO',
  'FAMILIA', 'FISCAL', 'ADMINISTRATIVO', 'PROCESSUAL', 'OUTRO',
];

// ─────────────────────────────────────────
// GET — Obter artigo por ID (incrementa view_count)
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

    // Buscar artigo — filtrar SEMPRE por firm_id
    const article = await db.knowledgeArticle.findFirst({
      where: { id, firm_id: payload.firm_id },
      include: {
        created_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Incrementar view_count
    await db.knowledgeArticle.update({
      where: { id },
      data: { view_count: { increment: 1 } },
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
      view_count: article.view_count + 1,
      created_at: article.created_at,
      updated_at: article.updated_at,
      created_by: article.created_by,
    };

    return NextResponse.json({ success: true, data: formattedArticle });
  } catch (error) {
    console.error('[KNOWLEDGE GET] Erro interno:', error);
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
// PATCH — Actualizar artigo
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar artigos
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
    const { id } = await params;

    // Verificar se o artigo existe e pertence ao escritório
    const existingArticle = await db.knowledgeArticle.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { title, content, category, source, tags, is_pinned } = body as {
      title?: string;
      content?: string;
      category?: string;
      source?: string;
      tags?: string;
      is_pinned?: boolean;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
      errors.push('Título deve ter no mínimo 2 caracteres.');
    }

    if (content !== undefined && (typeof content !== 'string' || content.trim().length < 10)) {
      errors.push('Conteúdo deve ter no mínimo 10 caracteres.');
    }

    if (category !== undefined && !VALID_CATEGORIES.includes(category.toUpperCase())) {
      errors.push(`Categoria inválida. Valores: ${VALID_CATEGORIES.join(', ')}`);
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

    // ── Construir dados de actualização ──
    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (title !== undefined) {
      oldValues.title = existingArticle.title;
      updateData.title = title.trim();
      newValues.title = updateData.title;
    }

    if (content !== undefined) {
      oldValues.content = '(conteúdo anterior)';
      updateData.content = content.trim();
      newValues.content = '(conteúdo actualizado)';
    }

    if (category !== undefined) {
      oldValues.category = existingArticle.category;
      updateData.category = category.toUpperCase();
      newValues.category = updateData.category;
    }

    if (source !== undefined) {
      oldValues.source = existingArticle.source;
      updateData.source = source?.trim() || null;
      newValues.source = updateData.source;
    }

    if (tags !== undefined) {
      let parsedTags: unknown[] = [];
      if (tags && typeof tags === 'string' && tags.trim().length > 0) {
        try {
          parsedTags = JSON.parse(tags);
          if (!Array.isArray(parsedTags)) {
            parsedTags = [tags.trim()];
          }
        } catch {
          parsedTags = [tags.trim()];
        }
      }
      oldValues.tags = existingArticle.tags;
      updateData.tags = JSON.stringify(parsedTags);
      newValues.tags = updateData.tags;
    }

    if (is_pinned !== undefined && typeof is_pinned === 'boolean') {
      oldValues.is_pinned = existingArticle.is_pinned;
      updateData.is_pinned = is_pinned;
      newValues.is_pinned = is_pinned;
    }

    // Nenhum campo para actualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Nenhum campo fornecido para actualização.',
          },
        },
        { status: 400 }
      );
    }

    // ── Actualizar artigo ──
    const updatedArticle = await db.knowledgeArticle.update({
      where: { id },
      data: updateData,
      include: {
        created_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta
    const formattedArticle = {
      id: updatedArticle.id,
      title: updatedArticle.title,
      content: updatedArticle.content,
      category: updatedArticle.category,
      source: updatedArticle.source,
      tags: updatedArticle.tags,
      is_pinned: updatedArticle.is_pinned,
      view_count: updatedArticle.view_count,
      created_at: updatedArticle.created_at,
      updated_at: updatedArticle.updated_at,
      created_by: updatedArticle.created_by,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'KNOWLEDGE_UPDATED',
      entity_type: 'KnowledgeArticle',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedArticle });
  } catch (error) {
    console.error('[KNOWLEDGE UPDATE] Erro interno:', error);
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
// DELETE — Eliminar artigo (ADMIN only)
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN pode eliminar artigos
  if (!hasRole(payload.role, ['ADMIN'])) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Sem permissão para realizar esta operação. Apenas administradores podem eliminar artigos.',
        },
      },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Verificar se o artigo existe e pertence ao escritório
    const existingArticle = await db.knowledgeArticle.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Artigo não encontrado.' },
        },
        { status: 404 }
      );
    }

    // ── Eliminar artigo ──
    await db.knowledgeArticle.delete({
      where: { id },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'KNOWLEDGE_DELETED',
      entity_type: 'KnowledgeArticle',
      entity_id: id,
      old_values: {
        title: existingArticle.title,
        category: existingArticle.category,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('[KNOWLEDGE DELETE] Erro interno:', error);
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
