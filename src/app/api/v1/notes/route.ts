// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Notas: POST (criar) e GET (listar)
// Rotas: POST /api/v1/notes, GET /api/v1/notes
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createNote, listNotes } from '@/lib/notes-db';
import { logAudit } from '@/lib/audit';

// ─────────────────────────────────────────
// GET: Listar notas
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  if (!entityType || !entityId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'entity_type e entity_id são obrigatórios.' } },
      { status: 400 },
    );
  }

  const validTypes = ['process', 'client', 'deadline'];
  if (!validTypes.includes(entityType)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'entity_type inválido. Use process, client ou deadline.' } },
      { status: 400 },
    );
  }

  try {
    const result = await listNotes({
      firm_id: auth.payload.firm_id,
      entity_type: entityType,
      entity_id: entityId,
      page,
      limit,
    });

    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: result.notes,
      meta: { total: result.total, page, limit, pages: totalPages },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar notas.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// POST: Criar nota
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { entity_type, entity_id, content, is_pinned } = body;

    // Validações
    const validTypes = ['process', 'client', 'deadline'];
    if (!entity_type || !validTypes.includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'entity_type inválido. Use process, client ou deadline.' } },
        { status: 400 },
      );
    }

    if (!entity_id || typeof entity_id !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'entity_id é obrigatório.' } },
        { status: 400 },
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'O conteúdo da nota é obrigatório (mínimo 1 carácter).' } },
        { status: 400 },
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'O conteúdo da nota não pode exceder 5000 caracteres.' } },
        { status: 400 },
      );
    }

    // Verificar propriedade do entity
    const { db } = await import('@/lib/db');
    if (entity_type === 'process') {
      const proc = await db.legalProcess.findFirst({
        where: { id: entity_id, firm_id: auth.payload.firm_id },
      });
      if (!proc) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Processo não encontrado neste escritório.' } },
          { status: 404 },
        );
      }
    } else if (entity_type === 'client') {
      const client = await db.client.findFirst({
        where: { id: entity_id, firm_id: auth.payload.firm_id },
      });
      if (!client) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrado neste escritório.' } },
          { status: 404 },
        );
      }
    } else if (entity_type === 'deadline') {
      // Verificar se o prazo pertence a um processo da firma
      const deadline = await db.deadline.findFirst({
        where: { id: entity_id },
        include: { process: { select: { firm_id: true } } },
      });
      if (!deadline || deadline.process.firm_id !== auth.payload.firm_id) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Prazo não encontrado neste escritório.' } },
          { status: 404 },
        );
      }
    }

    const note = await createNote({
      firm_id: auth.payload.firm_id,
      entity_type,
      entity_id,
      content: content.trim(),
      is_pinned: !!is_pinned,
      created_by: auth.payload.userId,
    });

    // Audit log
    logAudit({
      firm_id: auth.payload.firm_id,
      user_id: auth.payload.userId,
      action: 'NOTE_CREATED',
      entity_type: entity_type.toUpperCase(),
      entity_id,
      new_values: { note_id: note.id, is_pinned: !!is_pinned },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar nota.' } },
      { status: 500 },
    );
  }
}
