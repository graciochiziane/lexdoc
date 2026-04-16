// ═══════════════════════════════════════════════════════════════
// LEXDOC — Knowledge Base RAG Search Engine
// Pesquisa semântica simplificada com Prisma + scoring em memória
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string | null;
  score: number;
}

// ─────────────────────────────────────────
// Tokenização e normalização
// ─────────────────────────────────────────

/** Palavras de paragem em português — ignoradas na pesquisa */
const STOP_WORDS = new Set([
  'a', 'o', 'e', 'é', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'por', 'com',
  'para', 'ao', 'aos', 'à', 'às', 'como', 'mais', 'pelo', 'pela', 'pelos',
  'pelas', 'num', 'numa', 'ou', 'ser', 'ter', 'estar',
  'fazer', 'pode', 'deve', 'este', 'esta', 'esse', 'essa', 'isto', 'isso',
  'aquilo', 'sobre', 'entre', 'foi', 'são', 'tem', 'mas', 'não',
  'sim', 'já', 'ainda', 'muito', 'pouco', 'bem', 'mal', 'também', 'só',
  'quando', 'onde', 'quem', 'qual', 'cujo', 'cuja', 'cujos', 'cujas',
  'todo', 'toda', 'todos', 'todas', 'outro', 'outra', 'outros', 'outras',
  'mesmo', 'mesma', 'cada', 'qualquer', 'algum',
  'alguma', 'nenhum', 'nenhuma', 'depois', 'antes',
  'sempre', 'nunca', 'aqui', 'ali', 'lá', 'cá', 'então', 'porque',
  'pois', 'portanto', 'porém', 'contudo', 'todavia', 'senão',
  'desde', 'até', 'perante', 'minha', 'meu', 'sua', 'seu', 'suas', 'seus',
  'nossa', 'nosso', 'tua', 'teu', 'minhas', 'meus', 'tuas', 'teus',
]);

/** Normalizar texto para comparação (remover acentos, lowercase) */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/** Tokenizar query: separar palavras, remover stop words e normalizar */
function tokenizeQuery(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

// ─────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────

/** Calcular pontuação de relevância para um artigo */
function calculateScore(
  title: string,
  content: string,
  tags: string,
  source: string | null,
  isPinned: boolean,
  keywords: string[],
): number {
  let score = 0;

  const titleNorm = normalize(title);
  const contentNorm = normalize(content);
  const tagsNorm = normalize(tags);
  const sourceNorm = normalize(source || '');

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();

    // Título: maior peso (5 pontos por match)
    const titleMatches = (titleNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length;
    score += titleMatches * 5;

    // Tags: alto peso (4 pontos por match)
    const tagMatches = (tagsNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length;
    score += tagMatches * 4;

    // Fonte legal: peso médio (3 pontos)
    const sourceMatches = (sourceNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length;
    score += sourceMatches * 3;

    // Conteúdo: peso base (1 ponto por match, max 3 por keyword)
    const contentMatches = (contentNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length;
    score += Math.min(contentMatches, 3);

    // Bónus: keyword aparece no início do título
    if (titleNorm.startsWith(kw)) {
      score += 3;
    }

    // Bónus: keyword aparece no início do conteúdo (primeiros 200 chars)
    if (contentNorm.substring(0, 200).includes(kw)) {
      score += 1;
    }
  }

  // Bónus para artigos fixados (pinned)
  if (isPinned) {
    score += 2;
  }

  return score;
}

/** Contar ocorrências de um padrão numa string */
function countMatches(text: string, pattern: string): number {
  return (text.match(new RegExp(pattern, 'gi')) || []).length;
}

// ─────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────

/**
 * Pesquisar artigos da base de conhecimento usando RAG simplificado.
 * Tokeniza a query em keywords, pesquisa no SQLite com Prisma, e pontua por relevância.
 *
 * @param firmId - ID da firma para isolamento multi-tenant
 * @param query - Texto da pesquisa
 * @param limit - Número máximo de resultados (padrão: 5)
 */
export async function searchKnowledgeArticles(
  firmId: string,
  query: string,
  limit: number = 5,
): Promise<KnowledgeSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const keywords = tokenizeQuery(query.trim());

  if (keywords.length === 0) {
    return [];
  }

  // Construir condições OR para cada keyword nos campos pesquisáveis
  const conditions: Array<{ OR: Array<Record<string, { contains: string }>> }> = [];

  for (const keyword of keywords) {
    conditions.push(
      {
        OR: [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
          { tags: { contains: keyword } },
          { source: { contains: keyword } },
        ],
      },
    );
  }

  // Buscar artigos que contenham pelo menos uma keyword
  const articles = await db.knowledgeArticle.findMany({
    where: {
      firm_id: firmId,
      OR: conditions,
    },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      source: true,
      tags: true,
      is_pinned: true,
    },
  });

  // Calcular score para cada artigo
  const scored = articles.map((article) => {
    const score = calculateScore(
      article.title,
      article.content,
      article.tags,
      article.source,
      article.is_pinned,
      keywords,
    );

    return {
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      source: article.source,
      score,
    };
  });

  // Ordenar por score descendente e limitar resultados
  scored.sort((a, b) => b.score - a.score);

  // Filtrar resultados com score > 0 e limitar
  return scored
    .filter((r) => r.score > 0)
    .slice(0, limit);
}

// Exportação auxiliar — não utilizada mas mantida para referência futura
void countMatches;
