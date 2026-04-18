// ═══════════════════════════════════════════════════════════════
// LEXDOC — Notas/Tarefas: CRUD via Prisma ORM
// Suporta entity_type: "process" | "client" | "deadline" | "general"
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface NoteRecord {
  id: string;
  firm_id: string;
  entity_type: string;
  entity_id: string | null;
  content: string;
  is_pinned: boolean;
  is_completed: boolean;
  priority: string;
  due_date: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface NoteWithUser extends NoteRecord {
  user_name?: string;
}

// ─────────────────────────────────────────
// Tipos válidos
// ─────────────────────────────────────────
export const VALID_ENTITY_TYPES = ['process', 'client', 'deadline', 'general'];
export const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// ─────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────

export async function createNote(data: {
  firm_id: string;
  entity_type: string;
  entity_id?: string | null;
  content: string;
  is_pinned: boolean;
  is_completed?: boolean;
  priority?: string;
  due_date?: string | null;
  created_by: string;
}): Promise<NoteWithUser> {
  const note = await db.note.create({
    data: {
      firm_id: data.firm_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id ?? null,
      content: data.content,
      is_pinned: data.is_pinned,
      is_completed: data.is_completed ?? false,
      priority: data.priority ?? 'low',
      due_date: data.due_date ? new Date(data.due_date) : null,
      created_by_id: data.created_by,
    },
    include: {
      created_by: { select: { full_name: true } },
    },
  });

  return {
    id: note.id,
    firm_id: note.firm_id,
    entity_type: note.entity_type,
    entity_id: note.entity_id,
    content: note.content,
    is_pinned: note.is_pinned,
    is_completed: note.is_completed,
    priority: note.priority,
    due_date: note.due_date?.toISOString() ?? null,
    created_by_id: note.created_by_id,
    created_at: note.created_at.toISOString(),
    updated_at: note.updated_at.toISOString(),
    user_name: note.created_by.full_name,
  };
}

export async function listNotes(params: {
  firm_id: string;
  entity_type: string;
  entity_id?: string | null;
  created_by_id?: string;
  page?: number;
  limit?: number;
}): Promise<{ notes: NoteWithUser[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    firm_id: params.firm_id,
    entity_type: params.entity_type,
  };

  // For general type, optionally filter by created_by_id (personal tasks)
  if (params.entity_type === 'general' && params.created_by_id) {
    where.created_by_id = params.created_by_id;
  } else if (params.entity_id) {
    where.entity_id = params.entity_id;
  }

  const [notes, total] = await Promise.all([
    db.note.findMany({
      where,
      include: {
        created_by: { select: { full_name: true } },
      },
      orderBy: [
        { is_pinned: 'desc' },
        { is_completed: 'asc' },
        { priority: 'desc' },
        { updated_at: 'desc' },
      ],
      skip,
      take: limit,
    }),
    db.note.count({ where }),
  ]);

  return {
    notes: notes.map((note) => ({
      id: note.id,
      firm_id: note.firm_id,
      entity_type: note.entity_type,
      entity_id: note.entity_id,
      content: note.content,
      is_pinned: note.is_pinned,
      is_completed: note.is_completed,
      priority: note.priority,
      due_date: note.due_date?.toISOString() ?? null,
      created_by_id: note.created_by_id,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
      user_name: note.created_by.full_name,
    })),
    total,
  };
}

export async function getNoteById(id: string, firm_id: string): Promise<NoteRecord | null> {
  const note = await db.note.findFirst({
    where: { id, firm_id },
  });
  if (!note) return null;

  return {
    id: note.id,
    firm_id: note.firm_id,
    entity_type: note.entity_type,
    entity_id: note.entity_id,
    content: note.content,
    is_pinned: note.is_pinned,
    is_completed: note.is_completed,
    priority: note.priority,
    due_date: note.due_date?.toISOString() ?? null,
    created_by_id: note.created_by_id,
    created_at: note.created_at.toISOString(),
    updated_at: note.updated_at.toISOString(),
  };
}

export async function updateNote(
  id: string,
  firm_id: string,
  data: {
    content?: string;
    is_pinned?: boolean;
    is_completed?: boolean;
    priority?: string;
    due_date?: string | null;
  },
): Promise<NoteWithUser | null> {
  const updateData: Record<string, unknown> = { updated_at: new Date() };

  if (data.content !== undefined) updateData.content = data.content;
  if (data.is_pinned !== undefined) updateData.is_pinned = data.is_pinned;
  if (data.is_completed !== undefined) updateData.is_completed = data.is_completed;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.due_date !== undefined) {
    updateData.due_date = data.due_date ? new Date(data.due_date) : null;
  }

  const note = await db.note.update({
    where: { id },
    data: updateData,
    include: {
      created_by: { select: { full_name: true } },
    },
  });

  return {
    id: note.id,
    firm_id: note.firm_id,
    entity_type: note.entity_type,
    entity_id: note.entity_id,
    content: note.content,
    is_pinned: note.is_pinned,
    is_completed: note.is_completed,
    priority: note.priority,
    due_date: note.due_date?.toISOString() ?? null,
    created_by_id: note.created_by_id,
    created_at: note.created_at.toISOString(),
    updated_at: note.updated_at.toISOString(),
    user_name: note.created_by.full_name,
  };
}

export async function deleteNote(id: string, firm_id: string): Promise<boolean> {
  try {
    await db.note.deleteMany({ where: { id, firm_id } });
    return true;
  } catch {
    return false;
  }
}
