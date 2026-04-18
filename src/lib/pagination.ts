// ═══════════════════════════════════════════════════════════════
// LEXDOC — Utilitários de Paginação
// Funções partilhadas para todas as rotas CRUD
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────

/** Extrair parâmetros de paginação dos query params */
export function parsePagination(
  searchParams: URLSearchParams
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20)
  );
  return { page, limit };
}

/** Construir metadados de paginação */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return { total, page, limit, pages: Math.ceil(total / limit) };
}

/** Calcular offset para Prisma skip */
export function calcSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
