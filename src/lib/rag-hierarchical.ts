// ═══════════════════════════════════════════════════════════════
// LEXDOC — RAG Hierárquico 3 Camadas (System Orchestrator v3.0)
// Recuperação em cascata: OURO → PRATA → BRONZE
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { KnowledgeSearchResult } from './rag-search';
import { rewriteQuery, type RewrittenQuery } from './query-rewriter';

// ─────────────────────────────────────────
// Tipos — Camadas de Conhecimento
// ═══════════════════════════════════════════════════

export type KnowledgeTier = 'OURO' | 'PRATA' | 'BRONZE' | 'NENHUMA';

export interface TieredSearchResult {
  /** Camada que forneceu os resultados */
  tier: KnowledgeTier;
  /** Artigos encontrados (com score) */
  articles: KnowledgeSearchResult[];
  /** Score máximo normalizado da camada (0-100) */
  confidenceScore: number;
  /** Se a pesquisa nesta camada foi suficiente */
  isSufficient: boolean;
}

export interface HierarchicalSearchResult {
  /** Query original do utilizador */
  originalQuery: string;
  /** Query reescrita com expansão semântica */
  rewrittenQuery: RewrittenQuery;
  /** Camada que forneceu a resposta */
  activeTier: KnowledgeTier;
  /** Resultados da camada activa */
  results: KnowledgeSearchResult[];
  /** Score de confiança final (0-100) */
  confidenceScore: number;
  /** Todas as camadas pesquisadas (para auditoria) */
  allTiers: {
    tier: KnowledgeTier;
    articleCount: number;
    topScore: number;
    isSufficient: boolean;
  }[];
  /** Metadata de auditoria */
  audit: {
    /** Se o query rewriter LLM foi usado */
    llmRewriteUsed: boolean;
    /** Áreas do direito detectadas */
    detectedAreas: string[];
    /** Timestamp da pesquisa */
    timestamp: string;
  };
}

// ─────────────────────────────────────────
// Mapeamento Categorias → Camadas
// ═══════════════════════════════════════════════════

/**
 * CAMADA OURO — Strict Compliance
 * Contém: legislação moçambicana, regulamentos oficiais, minutas aprovadas, jurisprudência validada
 */
const OURO_CATEGORIES = [
  'legislacao', 'legislação', 'constituicao', 'constituição',
  'codigo', 'código', 'lei', 'decreto', 'decreto-lei',
  'regulamento', 'resolucao', 'resolução', 'portaria',
  'diploma', 'boletim', 'jurisprudencia', 'jurisprudência',
  'acordao', 'acórdão', 'sentenca', 'sentença',
  'minuta', 'contrato-tipo', 'modelo',
];

/**
 * CAMADA PRATA — General Legal Reasoning
 * Contém: doutrina, guias, boas práticas, artigos especializados
 */
const PRATA_CATEGORIES = [
  'doutrina', 'guia', 'guia-juridico', 'guia-jurídico',
  'boas-praticas', 'boas-práticas', 'artigo', 'analise',
  'análise', 'parecer', 'opiniao', 'opinião',
  'comentario', 'comentário', 'nota-tecnica', 'nota-técnica',
  'orientacao', 'orientação', 'manual', 'procedimento',
  ' checklist', 'faq', 'perguntas-frequentes',
];

/** Todas as outras categorias que não se encaixam em OURO ou PRATA */
const OTHER_CATEGORIES = ['OUTRO', 'outro', 'geral', 'geral', 'misc', 'diversos', 'informação'];

/** Verifica se uma categoria pertence à camada OURO */
function isOuroCategory(category: string): boolean {
  const cat = category.toLowerCase().trim();
  return OURO_CATEGORIES.some(oc => cat.includes(oc));
}

/** Verifica se uma categoria pertence à camada PRATA */
function isPrataCategory(category: string): boolean {
  const cat = category.toLowerCase().trim();
  return PRATA_CATEGORIES.some(pc => cat.includes(pc));
}

// ─────────────────────────────────────────
// Thresholds por Camada
// ═══════════════════════════════════════════════════

/** Score mínimo para considerar uma camada "suficiente" */
const TIER_THRESHOLDS: Record<KnowledgeTier, number> = {
  OURO: 5,    // Basta 1 resultado de legislação para ser suficiente
  PRATA: 15,  // Necessita score mais alto para confiar em doutrina
  BRONZE: 10, // Fontes web precisam de score médio
  NENHUMA: 0,
};

/** Máximo de artigos por camada */
const TIER_LIMITS: Record<KnowledgeTier, number> = {
  OURO: 5,
  PRATA: 3,
  BRONZE: 3,
  NENHUMA: 0,
};

// ─────────────────────────────────────────
// Funções de Pesquisa por Camada
// ═══════════════════════════════════════════════════

/**
 * Normaliza e tokeniza query para pesquisa
 * (reutiliza a lógica do rag-search original)
 */
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

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/** Normaliza score bruto para 0-100 */
function normalizeScore(rawScore: number): number {
  const MAX_SCORE = 50;
  return Math.min(100, Math.round((rawScore / MAX_SCORE) * 100));
}

/** Calcula score de relevância para um artigo */
function calculateScore(
  title: string, content: string, tags: string, source: string | null,
  isPinned: boolean, keywords: string[],
): number {
  let score = 0;
  const titleNorm = normalize(title);
  const contentNorm = normalize(content);
  const tagsNorm = normalize(tags);
  const sourceNorm = normalize(source || '');

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase();
    score += (titleNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length * 5;
    score += (tagsNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length * 4;
    score += (sourceNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length * 3;
    const contentMatches = (contentNorm.match(new RegExp(`\\b${kw}\\w*\\b`, 'g')) || []).length;
    score += Math.min(contentMatches, 3);
    if (titleNorm.startsWith(kw)) score += 3;
    if (contentNorm.substring(0, 200).includes(kw)) score += 1;
  }

  if (isPinned) score += 2;

  // Bónus de fiabilidade da fonte
  const src = (source || '').toLowerCase();
  if (src.includes('boletim da república') || src.includes('boletim da republica')) score += 10;
  if (src.includes('.mz') || src.includes('moçambique') || src.includes('mozambique')) score += 6;
  if (src.includes('assembleia da república') || src.includes('conselho de ministros')) score += 8;
  if (src.includes('irej') || src.includes('ctc') || src.includes('pgr') || src.includes('inss') || src.includes('oam')) score += 5;

  // Penalização de fontes portuguesas
  if (src.includes('diário da república') && !src.includes('moçambique')) score -= 20;
  if (src.includes('portugal') || src.includes('.pt')) score -= 20;

  return score;
}

/**
 * Pesquisa artigos filtrados por categoria (para uma camada específica)
 */
async function searchByTier(
  firmId: string,
  query: string,
  tier: KnowledgeTier,
): Promise<TieredSearchResult> {
  const keywords = tokenize(query);
  if (keywords.length === 0) {
    return { tier, articles: [], confidenceScore: 0, isSufficient: false };
  }

  // Construir condições OR para cada keyword
  const conditions: Array<{ OR: Array<Record<string, { contains: string }>> }> = [];
  for (const keyword of keywords) {
    conditions.push({
      OR: [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
        { tags: { contains: keyword } },
        { source: { contains: keyword } },
      ],
    });
  }

  // Filtrar por categoria baseado na camada
  let categoryFilter: Record<string, unknown>;
  if (tier === 'OURO') {
    // OURO: busca por categorias de legislação, MAS também inclui artigos
    // com fontes moçambicanas oficiais (independentemente da categoria)
    categoryFilter = {
      OR: [
        { category: { in: OURO_CATEGORIES } },
        { source: { contains: 'Boletim da República' } },
        { source: { contains: 'boletim da republica' } },
        { source: { contains: 'Assembleia da República' } },
      ],
    };
  } else if (tier === 'PRATA') {
    categoryFilter = { category: { in: PRATA_CATEGORIES } };
  } else {
    // BRONZE e NENHUMA: busca geral (sem filtro de categoria)
    categoryFilter = {};
  }

  // Combinar: (keyword conditions) AND (category filter)
  const articles = await db.knowledgeArticle.findMany({
    where: {
      firm_id: firmId,
      ...categoryFilter,
      OR: conditions,
    },
    select: {
      id: true, title: true, content: true, category: true,
      source: true, tags: true, is_pinned: true,
    },
  });

  // Calcular scores e ordenar
  const scored = articles
    .map(article => {
      const score = calculateScore(
        article.title, article.content, article.tags, article.source,
        article.is_pinned, keywords,
      );
      return {
        id: article.id, title: article.title, content: article.content,
        category: article.category, source: article.source, score,
      };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TIER_LIMITS[tier]);

  const topScore = scored.length > 0 ? scored[0].score : 0;
  const normScore = normalizeScore(topScore);
  const threshold = TIER_THRESHOLDS[tier];

  return {
    tier,
    articles: scored,
    confidenceScore: normScore,
    isSufficient: normScore >= threshold && scored.length > 0,
  };
}

// ─────────────────────────────────────────
// Função Principal — Pesquisa Hierárquica
// ═══════════════════════════════════════════════════

/**
 * Pesquisa hierárquica em cascata: OURO → PRATA → geral.
 * Para a camada BRONZE (internet), retorna apenas os metadados.
 * A busca web real é feita pelo chamador (stream/route) via web-search.
 *
 * @param firmId - ID da firma
 * @param query - Query do utilizador
 * @param useLLMRewrite - Se deve usar LLM para reescrita (quando dicionário insuficiente)
 */
export async function hierarchicalSearch(
  firmId: string,
  query: string,
  useLLMRewrite: boolean = false,
): Promise<HierarchicalSearchResult> {
  // 1. Query Rewriter (dicionário)
  const rewritten = rewriteQuery(query);

  // 2. Determinar qual query usar para pesquisa
  // Se o dicionário expandiu bem, usar a query expandida
  // Se não, usar a query original (mais precisa)
  const searchQuery = rewritten.legalTerms.length > 0
    ? `${query} ${rewritten.legalTerms.slice(0, 6).join(' ')}`
    : query;

  // 3. Pesquisa em cascata: OURO → PRATA → geral
  const ouroResults = await searchByTier(firmId, searchQuery, 'OURO');
  const allTiers: HierarchicalSearchResult['allTiers'] = [
    {
      tier: 'OURO',
      articleCount: ouroResults.articles.length,
      topScore: ouroResults.confidenceScore,
      isSufficient: ouroResults.isSufficient,
    },
  ];

  // Se OURO é suficiente, parar aqui
  if (ouroResults.isSufficient) {
    return {
      originalQuery: query,
      rewrittenQuery: rewritten,
      activeTier: 'OURO',
      results: ouroResults.articles,
      confidenceScore: ouroResults.confidenceScore,
      allTiers,
      audit: {
        llmRewriteUsed: false,
        detectedAreas: rewritten.detectedAreas,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 4. Camada PRATA
  const prataResults = await searchByTier(firmId, searchQuery, 'PRATA');
  allTiers.push({
    tier: 'PRATA',
    articleCount: prataResults.articles.length,
    topScore: prataResults.confidenceScore,
    isSufficient: prataResults.isSufficient,
  });

  if (prataResults.isSufficient) {
    return {
      originalQuery: query,
      rewrittenQuery: rewritten,
      activeTier: 'PRATA',
      results: prataResults.articles,
      confidenceScore: prataResults.confidenceScore,
      allTiers,
      audit: {
        llmRewriteUsed: false,
        detectedAreas: rewritten.detectedAreas,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 5. Camada BRONZE — Pesquisa geral (sem filtro de categoria)
  // Esta busca pode retornar artigos de qualquer categoria
  const bronzeResults = await searchByTier(firmId, searchQuery, 'BRONZE');
  allTiers.push({
    tier: 'BRONZE',
    articleCount: bronzeResults.articles.length,
    topScore: bronzeResults.confidenceScore,
    isSufficient: bronzeResults.isSufficient,
  });

  if (bronzeResults.isSufficient) {
    return {
      originalQuery: query,
      rewrittenQuery: rewritten,
      activeTier: 'BRONZE',
      results: bronzeResults.articles,
      confidenceScore: bronzeResults.confidenceScore,
      allTiers,
      audit: {
        llmRewriteUsed: false,
        detectedAreas: rewritten.detectedAreas,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 6. NENHUMA camada suficiente
  return {
    originalQuery: query,
    rewrittenQuery: rewritten,
    activeTier: 'NENHUMA',
    results: [],
    confidenceScore: 0,
    allTiers,
    audit: {
      llmRewriteUsed: false,
      detectedAreas: rewritten.detectedAreas,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────
// Labels para UI
// ═══════════════════════════════════════

export const TIER_LABELS: Record<KnowledgeTier, { label: string; emoji: string; color: string; description: string }> = {
  OURO: {
    label: 'Legislação Moçambicana',
    emoji: '🏛️',
    color: 'text-amber-400',
    description: 'Leis, decretos, regulamentos oficiais e jurisprudência validada',
  },
  PRATA: {
    label: 'Doutrina e Guias',
    emoji: '📘',
    color: 'text-blue-400',
    description: 'Doutrina, boas práticas jurídicas e guias especializados',
  },
  BRONZE: {
    label: 'Base Geral',
    emoji: '🌐',
    color: 'text-slate-400',
    description: 'Conhecimento geral e fontes complementares',
  },
  NENHUMA: {
    label: 'Sem Resultados',
    emoji: '⚠️',
    color: 'text-red-400',
    description: 'Nenhum documento encontrado na base de conhecimento',
  },
};