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

/** Calcular bónus de fiabilidade da fonte (Governança V2.0) */
function calculateSourceReliabilityBonus(source: string | null): { bonus: number; penalty: number; flag: string | null } {
  if (!source) return { bonus: 0, penalty: 0, flag: null };

  const src = source.toLowerCase();

  // Alta fiabilidade — Fontes moçambicanas oficiais
  if (src.includes('boletim da república') || src.includes('boletim da republica')) {
    return { bonus: 10, penalty: 0, flag: 'boletim-mz' };
  }
  if (src.includes('assembleia da república') || src.includes('conselho de ministros')) {
    return { bonus: 8, penalty: 0, flag: 'orgao-legislativo-mz' };
  }
  if (src.includes('.mz') || src.includes('moçambique') || src.includes('mozambique')) {
    return { bonus: 6, penalty: 0, flag: 'fonte-mz' };
  }
  if (src.includes('irej') || src.includes('ctc') || src.includes('pgr') || src.includes('inss') || src.includes('oam')) {
    return { bonus: 5, penalty: 0, flag: 'instituicao-mz' };
  }

  // Média fiabilidade
  if (src.includes('stj') || src.includes('tribunal')) {
    return { bonus: 2, penalty: 0, flag: 'verificar-mz' };
  }

  // Baixa fiabilidade — Possível contaminação lusófona
  if (src.includes('diário da república') && !src.includes('moçambique')) {
    return { bonus: 0, penalty: 20, flag: 'fonte-pt' };
  }
  if (src.includes('portugal') || src.includes('.pt')) {
    return { bonus: 0, penalty: 20, flag: 'fonte-pt' };
  }
  if (src.includes('freguesia') || src.includes('concelho')) {
    return { bonus: 0, penalty: 25, flag: 'erro-contexto-pt' };
  }

  return { bonus: 0, penalty: 0, flag: null };
}

/** Calcular pontuação de relevância para um artigo (V2.0 com ranking de fontes) */
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

  // Governança V2.0: Ranking de fiabilidade da fonte
  const reliability = calculateSourceReliabilityBonus(source);
  score += reliability.bonus;
  score -= reliability.penalty;

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
