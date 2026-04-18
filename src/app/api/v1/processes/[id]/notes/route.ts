// ═══════════════════════════════════════════════════════════════
// LEXDOC — Notas do Processo (Process Notes)
// GET  /api/v1/processes/:id/notes — Listar notas
// POST /api/v1/processes/:id/notes — Criar nota
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Listar notas do processo
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  const { id } = await params;

  try {
    // Verify process belongs to firm
    const process = await db.legalProcess.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Processo não encontrado.' } },
        { status: 404 },
      );
    }

    const notes = await db.processNote.findMany({
      where: { process_id: id },
      orderBy: { created_at: 'asc' },
    });

    // Get user names for notes
    const userIds = [...new Set(notes.map((n) => n.created_by))];
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.full_name]));

    const formatted = notes.map((n) => ({
      id: n.id,
      process_id: n.process_id,
      content: n.content,
      created_by: n.created_by,
      created_by_name: userMap.get(n.created_by) ?? 'Desconhecido',
      created_at: n.created_at,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[PROCESS_NOTES LIST] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// POST — Criar nota no processo
// ─────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;
  const { id } = await params;

  // All authenticated users can create notes
  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO', 'SECRETARIO'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } },
      { status: 403 },
    );
  }

  try {
    // Verify process belongs to firm
    const process = await db.legalProcess.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Processo não encontrado.' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content || typeof content !== 'string' || content.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conteúdo da nota é obrigatório.' } },
        { status: 400 },
      );
    }

    const note = await db.processNote.create({
      data: {
        process_id: id,
        content: content.trim(),
        created_by: payload.sub,
      },
    });

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { full_name: true },
    });

    const formatted = {
      id: note.id,
      process_id: note.process_id,
      content: note.content,
      created_by: note.created_by,
      created_by_name: user?.full_name ?? 'Desconhecido',
      created_at: note.created_at,
    };

    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'PROCESS_NOTE_CREATED',
      entity_type: 'ProcessNote',
      entity_id: note.id,
      new_values: { process_id: id, process_number: process.process_number },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: formatted }, { status: 201 });
  } catch (error) {
    console.error('[PROCESS_NOTES CREATE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
