// ═══════════════════════════════════════════════════════════════
// LEXDOC — Documentos: Obter, Actualizar e Eliminar por ID
// GET    /api/v1/documents/:id — Obter documento com detalhes
// PATCH  /api/v1/documents/:id — Actualizar documento (ADMIN/ADVOGADO)
// DELETE /api/v1/documents/:id — Eliminar documento (soft delete)
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
const VALID_STATUSES = ['DRAFT', 'FINAL', 'SIGNED', 'ARCHIVED'];

// ─────────────────────────────────────────
// GET — Obter documento por ID
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

    // Buscar documento — filtrar SEMPRE por firm_id
    const document = await db.document.findFirst({
      where: { id, firm_id: payload.firm_id },
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
        updated_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Formatar resposta — NUNCA incluir file_key
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
      updated_by: document.updated_by,
    };

    return NextResponse.json({ success: true, data: formattedDocument });
  } catch (error) {
    console.error('[DOCUMENTS GET] Erro interno:', error);
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
// PATCH — Actualizar documento (com versionamento)
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar documentos
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

    // Verificar se o documento existe e pertence ao escritório
    const existingDocument = await db.document.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingDocument) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { title, description, status, is_confidential, tags } = body as {
      title?: string;
      description?: string;
      status?: string;
      is_confidential?: boolean;
      tags?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
      errors.push('Título deve ter no mínimo 2 caracteres.');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status.toUpperCase())) {
      errors.push('Estado inválido. Valores permitidos: DRAFT, FINAL, SIGNED, ARCHIVED.');
    }

    // Validar tags como JSON array se fornecido
    if (tags !== undefined) {
      try {
        const parsed = JSON.parse(tags);
        if (!Array.isArray(parsed) || !parsed.every((t: unknown) => typeof t === 'string')) {
          errors.push('Tags devem ser um array JSON de strings.');
        }
      } catch {
        errors.push('Tags devem ser um JSON válido (array de strings).');
      }
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
      oldValues.title = existingDocument.title;
      updateData.title = title.trim();
      newValues.title = updateData.title;
    }

    if (description !== undefined) {
      oldValues.description = existingDocument.description;
      updateData.description = description?.trim() || null;
      newValues.description = updateData.description;
    }

    if (status !== undefined) {
      oldValues.status = existingDocument.status;
      const newStatus = status.toUpperCase();
      updateData.status = newStatus;
      newValues.status = newStatus;
    }

    if (is_confidential !== undefined) {
      oldValues.is_confidential = existingDocument.is_confidential;
      updateData.is_confidential = Boolean(is_confidential);
      newValues.is_confidential = updateData.is_confidential;
    }

    if (tags !== undefined) {
      oldValues.tags = existingDocument.tags;
      updateData.tags = tags;
      newValues.tags = tags;
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

    // ── Criar snapshot da versão anterior ──
    await db.document.create({
      data: {
        firm_id: existingDocument.firm_id,
        process_id: existingDocument.process_id,
        created_by_id: existingDocument.created_by_id,
        updated_by_id: existingDocument.updated_by_id,
        title: existingDocument.title,
        description: existingDocument.description,
        file_key: existingDocument.file_key,
        file_name: existingDocument.file_name,
        file_size: existingDocument.file_size,
        mime_type: existingDocument.mime_type,
        version: existingDocument.version,
        parent_id: existingDocument.id,
        status: existingDocument.status,
        is_confidential: existingDocument.is_confidential,
        tags: existingDocument.tags,
      },
    });

    // ── Actualizar documento — incrementar versão e definir actualizador ──
    updateData.updated_by_id = payload.sub;
    updateData.version = existingDocument.version + 1;

    const updatedDocument = await db.document.update({
      where: { id },
      data: updateData,
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
        updated_by: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Formatar resposta — NUNCA incluir file_key
    const formattedDocument = {
      id: updatedDocument.id,
      title: updatedDocument.title,
      description: updatedDocument.description,
      file_name: updatedDocument.file_name,
      file_size: updatedDocument.file_size,
      mime_type: updatedDocument.mime_type,
      version: updatedDocument.version,
      status: updatedDocument.status,
      is_confidential: updatedDocument.is_confidential,
      tags: updatedDocument.tags,
      created_at: updatedDocument.created_at,
      updated_at: updatedDocument.updated_at,
      process_id: updatedDocument.process_id,
      created_by: updatedDocument.created_by,
      updated_by: updatedDocument.updated_by,
    };

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'DOCUMENT_UPDATED',
      entity_type: 'Document',
      entity_id: id,
      old_values: oldValues,
      new_values: {
        ...newValues,
        version: updatedDocument.version,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formattedDocument });
  } catch (error) {
    console.error('[DOCUMENTS UPDATE] Erro interno:', error);
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
// DELETE — Eliminar documento (soft delete)
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem eliminar documentos
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

    // Verificar se o documento existe e pertence ao escritório
    const existingDocument = await db.document.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingDocument) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Documento não encontrado.' },
        },
        { status: 404 }
      );
    }

    // ── Soft delete — alterar status para ARCHIVED ──
    await db.document.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        updated_by_id: payload.sub,
      },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'DOCUMENT_DELETED',
      entity_type: 'Document',
      entity_id: id,
      old_values: {
        title: existingDocument.title,
        status: existingDocument.status,
        file_name: existingDocument.file_name,
      },
      new_values: {
        status: 'ARCHIVED',
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { id, status: 'ARCHIVED' },
    });
  } catch (error) {
    console.error('[DOCUMENTS DELETE] Erro interno:', error);
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
