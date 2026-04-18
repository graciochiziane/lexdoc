// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Pesquisa Global
// Pesquisa em processos, clientes, documentos e prazos
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  created_at: string;
}

interface SearchGroup {
  type: string;
  label: string;
  count: number;
  items: SearchResultItem[];
}

interface SearchResponse {
  query: string;
  type: string;
  results: SearchGroup[];
  total: number;
}

const VALID_TYPES = ['all', 'processes', 'clients', 'documents', 'deadlines'] as const;

const TYPE_LABELS: Record<string, string> = {
  processes: 'Processos',
  clients: 'Clientes',
  documents: 'Documentos',
  deadlines: 'Prazos',
};

// ─────────────────────────────────────────
// GET /api/v1/search?q=keyword&type=all
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  // ── Autenticação ──
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const firmId = payload.firm_id;

  // ── Parâmetros ──
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();
  const type = (searchParams.get('type') ?? 'all').toLowerCase();
  const { page, limit } = parsePagination(searchParams);
  const skip = calcSkip(page, limit);

  // ── Validações ──
  if (!query || query.length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A pesquisa deve ter pelo menos 2 caracteres.' },
      },
      { status: 400 },
    );
  }

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Tipo inválido. Tipos válidos: ${VALID_TYPES.join(', ')}` },
      },
      { status: 400 },
    );
  }

  const searchPattern = `%${query}%`;
  const results: SearchGroup[] = [];
  let totalResults = 0;

  try {
    // ── Pesquisar Processos ──
    if (type === 'all' || type === 'processes') {
      const [items, count] = await Promise.all([
        db.legalProcess.findMany({
          where: {
            firm_id: firmId,
            OR: [
              { process_number: { contains: query } },
              { title: { contains: query } },
              { description: { contains: query } },
              { court: { contains: query } },
              { opposing_party: { contains: query } },
            ],
          },
          select: {
            id: true,
            process_number: true,
            title: true,
            status: true,
            created_at: true,
            client: { select: { full_name: true } },
          },
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        db.legalProcess.count({
          where: {
            firm_id: firmId,
            OR: [
              { process_number: { contains: query } },
              { title: { contains: query } },
              { description: { contains: query } },
              { court: { contains: query } },
              { opposing_party: { contains: query } },
            ],
          },
        }),
      ]);

      results.push({
        type: 'processes',
        label: TYPE_LABELS.processes,
        count,
        items: items.map((p) => ({
          id: p.id,
          title: `${p.process_number} — ${p.title}`,
          subtitle: p.client?.full_name,
          type: 'processes',
          created_at: p.created_at.toISOString(),
        })),
      });
      totalResults += count;
    }

    // ── Pesquisar Clientes ──
    if (type === 'all' || type === 'clients') {
      const [items, count] = await Promise.all([
        db.client.findMany({
          where: {
            firm_id: firmId,
            OR: [
              { full_name: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          },
          select: {
            id: true,
            full_name: true,
            email: true,
            client_type: true,
            created_at: true,
          },
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        db.client.count({
          where: {
            firm_id: firmId,
            OR: [
              { full_name: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          },
        }),
      ]);

      results.push({
        type: 'clients',
        label: TYPE_LABELS.clients,
        count,
        items: items.map((c) => ({
          id: c.id,
          title: c.full_name,
          subtitle: c.email ?? c.client_type,
          type: 'clients',
          created_at: c.created_at.toISOString(),
        })),
      });
      totalResults += count;
    }

    // ── Pesquisar Documentos ──
    if (type === 'all' || type === 'documents') {
      const [items, count] = await Promise.all([
        db.document.findMany({
          where: {
            firm_id: firmId,
            OR: [
              { title: { contains: query } },
              { file_name: { contains: query } },
              { description: { contains: query } },
            ],
          },
          select: {
            id: true,
            title: true,
            file_name: true,
            mime_type: true,
            created_at: true,
            process: {
              select: { process_number: true, title: true },
            },
          },
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        db.document.count({
          where: {
            firm_id: firmId,
            OR: [
              { title: { contains: query } },
              { file_name: { contains: query } },
              { description: { contains: query } },
            ],
          },
        }),
      ]);

      results.push({
        type: 'documents',
        label: TYPE_LABELS.documents,
        count,
        items: items.map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.process ? `${d.process.process_number}` : d.file_name,
          type: 'documents',
          created_at: d.created_at.toISOString(),
        })),
      });
      totalResults += count;
    }

    // ── Pesquisar Prazos ──
    if (type === 'all' || type === 'deadlines') {
      const [items, count] = await Promise.all([
        db.deadline.findMany({
          where: {
            process: {
              firm_id: firmId,
            },
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
            ],
          },
          select: {
            id: true,
            title: true,
            due_date: true,
            status: true,
            created_at: true,
            process: {
              select: { process_number: true, title: true },
            },
          },
          skip,
          take: limit,
          orderBy: { due_date: 'asc' },
        }),
        db.deadline.count({
          where: {
            process: {
              firm_id: firmId,
            },
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
            ],
          },
        }),
      ]);

      results.push({
        type: 'deadlines',
        label: TYPE_LABELS.deadlines,
        count,
        items: items.map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: d.process ? `${d.process.process_number} — ${d.due_date.toLocaleDateString('pt-MZ')}` : d.due_date.toLocaleDateString('pt-MZ'),
          type: 'deadlines',
          created_at: d.created_at.toISOString(),
        })),
      });
      totalResults += count;
    }

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: payload.sub,
      action: 'SEARCH',
      entity_type: 'GlobalSearch',
      metadata: { query, type, result_count: totalResults },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        results,
        total: totalResults,
        meta: buildPaginationMeta(totalResults, page, limit),
      } satisfies SearchResponse,
    });
  } catch (error) {
    console.error('[SEARCH] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
