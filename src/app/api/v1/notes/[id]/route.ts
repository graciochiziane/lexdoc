// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Notas/Tarefas: PATCH (actualizar) e DELETE (eliminar)
// Rotas: PATCH /api/v1/notes/[id], DELETE /api/v1/notes/[id]
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getNoteById, updateNote, deleteNote, VALID_PRIORITIES } from '@/lib/notes-db';
import { logAudit } from '@/lib/audit';

// ─────────────────────────────────────────
// PATCH: Actualizar nota/tarefa
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { id } = await params;

  try {
    // Verificar se a nota pertence à firma
    const existing = await getNoteById(id, auth.payload.firm_id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Nota não encontrada.' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { content, is_pinned, is_completed, priority, due_date } = body;

    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'O conteúdo deve ter pelo menos 1 carácter.' } },
          { status: 400 },
        );
      }
      if (content.length > 5000) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'O conteúdo não pode exceder 5000 caracteres.' } },
          { status: 400 },
        );
      }
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Prioridade inválida. Use: ${VALID_PRIORITIES.join(', ')}` } },
        { status: 400 },
      );
    }

    const updateData: {
      content?: string;
      is_pinned?: boolean;
      is_completed?: boolean;
      priority?: string;
      due_date?: string | null;
    } = {};

    if (content !== undefined) updateData.content = content.trim();
    if (is_pinned !== undefined) updateData.is_pinned = !!is_pinned;
    if (is_completed !== undefined) updateData.is_completed = !!is_completed;
    if (priority !== undefined) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;

    const updated = await updateNote(id, auth.payload.firm_id, updateData);

    // Audit log
    logAudit({
      firm_id: auth.payload.firm_id,
      user_id: auth.payload.sub,
      action: 'NOTE_UPDATED',
      entity_type: existing.entity_type.toUpperCase(),
      entity_id: existing.entity_id,
      old_values: { note_id: id, content: existing.content, is_pinned: existing.is_pinned, is_completed: existing.is_completed, priority: existing.priority },
      new_values: updateData,
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao actualizar nota.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// DELETE: Eliminar nota/tarefa
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { id } = await params;

  try {
    const existing = await getNoteById(id, auth.payload.firm_id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Nota não encontrada.' } },
        { status: 404 },
      );
    }

    await deleteNote(id, auth.payload.firm_id);

    // Audit log
    logAudit({
      firm_id: auth.payload.firm_id,
      user_id: auth.payload.sub,
      action: 'NOTE_DELETED',
      entity_type: existing.entity_type.toUpperCase(),
      entity_id: existing.entity_id,
      old_values: { note_id: id, content: existing.content },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao eliminar nota.' } },
      { status: 500 },
    );
  }
}
