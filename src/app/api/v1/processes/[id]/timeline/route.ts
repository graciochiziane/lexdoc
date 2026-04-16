// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Timeline do Processo
// GET /api/v1/processes/[id]/timeline
// Combina audit_logs + deadlines + notas do processo
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { db } from '@/lib/db';

// ─────────────────────────────────────────
// Tipos de entrada da timeline
// ─────────────────────────────────────────
interface TimelineEntry {
  id: string;
  type: 'audit' | 'deadline' | 'note';
  action: string;
  description: string;
  user_name: string;
  user_id: string | null;
  created_at: string;
  details?: Record<string, unknown>;
}

// Mapeamento de acções para descrições em português
const ACTION_DESCRIPTIONS: Record<string, string> = {
  PROCESS_CREATED: 'criou o processo',
  PROCESS_UPDATED: 'actualizou o processo',
  PROCESS_CLOSED: 'encerrou o processo',
  DOCUMENT_CREATED: 'adicionou um documento',
  DOCUMENT_UPDATED: 'actualizou um documento',
  DOCUMENT_DELETED: 'removeu um documento',
  DEADLINE_CREATED: 'criou um prazo',
  DEADLINE_UPDATED: 'actualizou um prazo',
  ASSIGNMENT_CREATED: 'atribuiu o processo',
  NOTE_CREATED: 'adicionou uma nota',
  NOTE_UPDATED: 'actualizou uma nota',
  NOTE_DELETED: 'removeu uma nota',
};

function getActionDescription(action: string): string {
  return ACTION_DESCRIPTIONS[action] ?? 'realizou uma acção';
}

// ─────────────────────────────────────────
// GET: Timeline do processo
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { id } = await params;

  try {
    // Verificar se o processo pertence à firma
    const process = await db.legalProcess.findFirst({
      where: { id, firm_id: auth.payload.firm_id },
    });

    if (!process) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Processo não encontrado.' } },
        { status: 404 },
      );
    }

    // Buscar audit_logs do processo
    const auditLogs = await db.auditLog.findMany({
      where: {
        entity_type: 'LegalProcess',
        entity_id: id,
        firm_id: auth.payload.firm_id,
      },
      include: {
        user: { select: { id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Buscar deadlines do processo
    const deadlines = await db.deadline.findMany({
      where: { process_id: id },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    // Converter audit_logs em entradas de timeline
    const auditEntries: TimelineEntry[] = auditLogs.map((log) => ({
      id: log.id,
      type: 'audit' as const,
      action: log.action,
      description: getActionDescription(log.action),
      user_name: log.user?.full_name ?? 'Sistema',
      user_id: log.user_id,
      created_at: log.created_at.toISOString(),
      details: log.new_values ? JSON.parse(log.new_values) : undefined,
    }));

    // Converter deadlines em entradas de timeline
    const deadlineEntries: TimelineEntry[] = deadlines.map((dl) => ({
      id: `dl-${dl.id}`,
      type: 'deadline' as const,
      action: dl.status === 'COMPLETED' ? 'DEADLINE_COMPLETED' : 'DEADLINE_CREATED',
      description: dl.status === 'COMPLETED'
        ? `concluiu o prazo: ${dl.title}`
        : `definiu o prazo: ${dl.title}`,
      user_name: 'Sistema',
      user_id: null,
      created_at: dl.created_at.toISOString(),
      details: {
        deadline_id: dl.id,
        title: dl.title,
        due_date: dl.due_date.toISOString(),
        status: dl.status,
      },
    }));

    // Buscar notas do processo (tabela raw SQL)
    const notes = await db.$queryRawUnsafe<Array<{
      id: string;
      firm_id: string;
      entity_type: string;
      entity_id: string;
      content: string;
      is_pinned: number;
      created_by: string;
      created_at: string;
      updated_at: string;
      user_name: string | null;
    }>>(
      `SELECT n.id, n.firm_id, n.entity_type, n.entity_id, n.content, n.is_pinned, n.created_by_id as created_by, n.created_at, n.updated_at, u.full_name as user_name
       FROM notes n
       LEFT JOIN users u ON n.created_by_id = u.id
       WHERE n.firm_id = ? AND n.entity_type = 'process' AND n.entity_id = ?
       ORDER BY n.created_at DESC
       LIMIT 20`,
      auth.payload.firm_id,
      id,
    );

    // Converter notas em entradas de timeline
    const noteEntries: TimelineEntry[] = notes.map((note) => ({
      id: `note-${note.id}`,
      type: 'note' as const,
      action: 'NOTE_ADDED',
      description: `adicionou uma nota: ${note.content.length > 60 ? note.content.slice(0, 60) + '…' : note.content}`,
      user_name: note.user_name ?? 'Utilizador',
      user_id: note.created_by,
      created_at: note.created_at,
      details: {
        note_id: note.id,
        content: note.content,
        is_pinned: note.is_pinned === 1,
      },
    }));

    // Combinar e ordenar por data (mais recente primeiro)
    const combined = [...auditEntries, ...deadlineEntries, ...noteEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    // Limitar a 50 entradas
    const timeline = combined.slice(0, 50);

    return NextResponse.json({
      success: true,
      data: timeline,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao carregar timeline.' } },
      { status: 500 },
    );
  }
}
