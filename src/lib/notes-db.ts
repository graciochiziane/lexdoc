// ═══════════════════════════════════════════════════════════════
// LEXDOC — Notas: Sistema autónomo com tabela SQLite via raw SQL
// Utiliza a mesma connection Prisma (mesma base de dados SQLite)
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface NoteRecord {
  id: string;
  firm_id: string;
  entity_type: 'process' | 'client' | 'deadline';
  entity_id: string;
  content: string;
  is_pinned: number; // 0 | 1
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NoteWithUser extends NoteRecord {
  user_name?: string;
}

// ─────────────────────────────────────────
// Criação automática da tabela
// ─────────────────────────────────────────
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  firm_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('process', 'client', 'deadline')),
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_firm_entity ON notes(firm_id, entity_type, entity_id);
`;

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  await db.$executeRawUnsafe(CREATE_TABLE);
  initialized = true;
}

// ─────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────

export async function createNote(data: {
  firm_id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  is_pinned: boolean;
  created_by: string;
}): Promise<NoteRecord> {
  await ensureTable();
  const result = await db.$queryRawUnsafe<NoteRecord[]>(
    `INSERT INTO notes (firm_id, entity_type, entity_id, content, is_pinned, created_by)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`,
    data.firm_id,
    data.entity_type,
    data.entity_id,
    data.content,
    data.is_pinned ? 1 : 0,
    data.created_by,
  );
  return result[0];
}

export async function listNotes(params: {
  firm_id: string;
  entity_type: string;
  entity_id: string;
  page?: number;
  limit?: number;
}): Promise<{ notes: NoteWithUser[]; total: number }> {
  await ensureTable();
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const rows = await db.$queryRawUnsafe<(NoteWithUser & { total_count: number })[]>(
    `SELECT n.*, u.full_name as user_name, COUNT(*) OVER() as total_count
     FROM notes n
     LEFT JOIN users u ON n.created_by = u.id
     WHERE n.firm_id = ? AND n.entity_type = ? AND n.entity_id = ?
     ORDER BY n.is_pinned DESC, n.updated_at DESC
     LIMIT ? OFFSET ?`,
    params.firm_id,
    params.entity_type,
    params.entity_id,
    limit,
    skip,
  );

  const total = rows.length > 0 ? rows[0].total_count : 0;
  const notes = rows.map(({ total_count: _tc, ...note }) => note);

  return { notes, total };
}

export async function getNoteById(id: string, firm_id: string): Promise<NoteRecord | null> {
  await ensureTable();
  const result = await db.$queryRawUnsafe<NoteRecord[]>(
    `SELECT * FROM notes WHERE id = ? AND firm_id = ?`,
    id,
    firm_id,
  );
  return result[0] ?? null;
}

export async function updateNote(
  id: string,
  firm_id: string,
  data: { content?: string; is_pinned?: boolean },
): Promise<NoteRecord | null> {
  await ensureTable();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (data.content !== undefined) {
    sets.push('content = ?');
    values.push(data.content);
  }
  if (data.is_pinned !== undefined) {
    sets.push('is_pinned = ?');
    values.push(data.is_pinned ? 1 : 0);
  }

  if (sets.length === 1) return getNoteById(id, firm_id);

  values.push(id, firm_id);
  await db.$executeRawUnsafe(
    `UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND firm_id = ?`,
    ...values,
  );
  return getNoteById(id, firm_id);
}

export async function deleteNote(id: string, firm_id: string): Promise<boolean> {
  await ensureTable();
  const result = await db.$executeRawUnsafe(
    `DELETE FROM notes WHERE id = ? AND firm_id = ?`,
    id,
    firm_id,
  );
  return (result as unknown as { count: number }).count > 0;
}
