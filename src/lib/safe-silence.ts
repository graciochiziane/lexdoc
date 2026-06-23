// ═══════════════════════════════════════════════════════════════
// LEXDOC — Motor de Silêncio Seguro (Governança V2.0 — Nível 4)
// Formaliza o threshold numérico de confiança do RAG.
// Se score < THRESHOLD ou sem fontes moçambicanas directas,
// dispara resposta de "informação insuficiente" em vez de LLM.
// ═══════════════════════════════════════════════════════════════

import type { KnowledgeSearchResult } from './rag-search';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────

/** Score mínimo de confiança para permitir resposta do LLM (0–100) */
export const CONFIDENCE_THRESHOLD = 8;

/** Score máximo possível (usado para normalização) */
const MAX_SCORE = 50;

/** Se score >= CONFIDENCE_HIGH, a resposta é "confiante" */
const CONFIDENCE_HIGH = 25;

/** Se score >= CONFIDENCE_MEDIUM e < HIGH, a resposta é "cautelosa" */
const CONFIDENCE_MEDIUM = 15;

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export type GovernanceLevel =
  | 'NENHUM'          // RAG vazio, conhecimento geral
  | 'SILENCIO_SEGURO' // Score abaixo do threshold — resposta de insuficiência
  | 'CAUTELAR'        // Score médio — LLM responde com disclaimer obrigatório
  | 'CONFIANTE'       // Score alto — resposta normal com fontes RAG
  | 'ALTA_CONFIANCA'; // Score muito alto — fontes moçambicanas oficiais

export interface SafeSilenceResult {
  /** Score de confiança calculado (0–100, normalizado) */
  confidence_score: number;
  /** Nível de governança accionado */
  nivel_governanca_accionado: GovernanceLevel;
  /** Se true, NÃO deve chamar o LLM — usar resposta de silêncio seguro */
  should_block_llm: boolean;
  /** Texto de resposta de silêncio seguro (só preenchido se should_block_llm=true) */
  safe_response: string | null;
  /** Quantos artigos do RAG foram encontrados */
  rag_article_count: number;
  /** Score bruto máximo dos artigos (antes de normalização) */
  raw_top_score: number;
  /** Se havia fontes moçambicanas directas */
  has_mozambican_source: boolean;
  /** Se havia fontes com penalização (portuguesas) */
  has_penalized_source: boolean;
  /** Metadata detalhada para auditoria */
  audit_details: {
    threshold_used: number;
    articles_scores: number[];
    source_flags: string[];
    trigger_reason: string | null;
  };
}

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────

/** Verifica se uma fonte é moçambicana (baseado no conteúdo do source) */
function isMozambicanSource(source: string | null): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return (
    s.includes('boletim da república') ||
    s.includes('boletim da republica') ||
    s.includes('moçambique') ||
    s.includes('mozambique') ||
    s.includes('.mz') ||
    s.includes('assembleia da república') ||
    s.includes('conselho de ministros') ||
    s.includes('irej') ||
    s.includes('ctc') ||
    s.includes('pgr') ||
    s.includes('inss') ||
    s.includes('oam')
  );
}

/** Verifica se uma fonte tem penalização (portuguesa) */
function isPenalizedSource(source: string | null): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return (
    (s.includes('diário da república') && !s.includes('moçambique')) ||
    s.includes('portugal') ||
    s.includes('.pt') ||
    s.includes('freguesia') ||
    s.includes('concelho')
  );
}

/** Extrai flags de fonte para auditoria */
function extractSourceFlags(articles: KnowledgeSearchResult[]): string[] {
  const flags: string[] = [];
  for (const a of articles) {
    if (a.source) {
      if (isMozambicanSource(a.source)) flags.push('fonte-mz');
      if (isPenalizedSource(a.source)) flags.push('fonte-pt-penalizada');
      if (!a.source) flags.push('sem-fonte');
    } else {
      flags.push('sem-fonte');
    }
  }
  return [...new Set(flags)];
}

/** Normaliza score bruto para 0–100 */
function normalizeScore(rawScore: number): number {
  return Math.min(100, Math.round((rawScore / MAX_SCORE) * 100));
}

/** Determina qual nível de governança foi accionado */
function determineGovernanceLevel(
  normalizedScore: number,
  hasMozSource: boolean,
  hasPenalty: boolean,
  articleCount: number,
): GovernanceLevel {
  // Nenhum artigo encontrado
  if (articleCount === 0) return 'NENHUM';

  // Fontes com penalização pesada (portuguesas) sem moçambicanas
  if (hasPenalty && !hasMozSource) return 'SILENCIO_SEGURO';

  // Score abaixo do threshold
  if (normalizedScore < CONFIDENCE_THRESHOLD) return 'SILENCIO_SEGURO';

  // Score médio — responder com cautela
  if (normalizedScore < CONFIDENCE_MEDIUM) return 'CAUTELAR';

  // Score alto com fonte moçambicana directa
  if (hasMozSource && normalizedScore >= CONFIDENCE_HIGH) return 'ALTA_CONFIANCA';

  // Score alto sem fonte moçambicana (pode ser conhecimento geral bom)
  if (normalizedScore >= CONFIDENCE_HIGH) return 'CONFIANTE';

  // Score médio-alto
  return 'CAUTELAR';
}

// ─────────────────────────────────────────
// Respostas de Silêncio Seguro
// ─────────────────────────────────────────

function buildSafeSilenceResponse(level: GovernanceLevel, articleCount: number): string {
  const timestamp = new Date().toISOString();

  if (level === 'NENHUM') {
    return `## ⚠️ Informação Insuficiente

Não foi possível localizar documentos na base de conhecimento da firma para responder a esta consulta com confiança.

### Recomendações:
1. **Consulte o Boletim da República de Moçambique** em [brel.gov.mz](https://www.brel.gov.mz)
2. **Contacte um advogado inscrito na OAM** para orientação especializada
3. **Verifique a base de conhecimento** — adicione legislação moçambicana relevante ao LexDoc RAG

> *Esta resposta foi gerada automaticamente pelo Sistema de Governança V2.0 — Nível 4 (Silêncio Seguro). O assistente optou por não especular em vez de arriscar informação incorrecta.*

---
*[NOTA DE AUDITORIA] ${timestamp} | 🔒 Sessão isolada | 🛡️ Silêncio Seguro activado (Nível NENHUM — RAG vazio) | Governança V2.0*`;
  }

  return `## ⚠️ Informação Insuficiente

Foram encontrados ${articleCount} documento(s) na base de conhecimento, mas a **pontuação de relevância é demasiado baixa** para garantir uma resposta precisa e fundamentada.

### Recomendações:
1. **Refine a consulta** com termos mais específicos (ex: nome da lei, número do decreto)
2. **Consulte o Boletim da República de Moçambique** em [brel.gov.mz](https://www.brel.gov.mz)
3. **Contacte um advogado inscrito na OAM** para validação profissional

> *Esta resposta foi gerada automaticamente pelo Sistema de Governança V2.0 — Nível 4 (Silêncio Seguro). O score de confiança não atingiu o threshold mínimo para resposta assistida.*

---
*[NOTA DE AUDITORIA] ${timestamp} | 🔒 Sessão isolada | 🛡️ Silêncio Seguro activado (Nível SILENCIO_SEGURO — score abaixo do threshold) | Governança V2.0*`;
}

// ─────────────────────────────────────────
// Função Principal — Gate de Silêncio Seguro
// ─────────────────────────────────────────

/**
 * Avalia os resultados do RAG e determina se o LLM deve ser bloqueado.
 * Esta função é o gate central do Silêncio Seguro (Nível 4 da Governança V2.0).
 *
 * @param ragResults - Resultados da pesquisa RAG (vindos de searchKnowledgeArticles)
 * @returns SafeSilenceResult com score, nível, e decisão de bloqueio
 */
export function evaluateSafeSilence(ragResults: KnowledgeSearchResult[]): SafeSilenceResult {
  const articleCount = ragResults.length;
  const articlesScores = ragResults.map((r) => r.score);
  const rawTopScore = articleCount > 0 ? Math.max(...articlesScores) : 0;
  const normalizedScore = normalizeScore(rawTopScore);

  const hasMozSource = ragResults.some((r) => isMozambicanSource(r.source));
  const hasPenalty = ragResults.some((r) => isPenalizedSource(r.source));
  const sourceFlags = extractSourceFlags(ragResults);

  // Determinar nível de governança
  const nivel = determineGovernanceLevel(normalizedScore, hasMozSource, hasPenalty, articleCount);

  // Decisão de bloqueio
  const shouldBlock = nivel === 'NENHUM' || nivel === 'SILENCIO_SEGURO';

  // Motivo do trigger (para auditoria)
  let triggerReason: string | null = null;
  if (nivel === 'NENHUM') {
    triggerReason = 'RAG_VAZIO';
  } else if (nivel === 'SILENCIO_SEGURO') {
    if (hasPenalty && !hasMozSource) {
      triggerReason = 'FONTE_PENALIZADA_SEM_MZ';
    } else {
      triggerReason = `SCORE_ABAIXO_THRESHOLD (${normalizedScore} < ${CONFIDENCE_THRESHOLD})`;
    }
  }

  return {
    confidence_score: normalizedScore,
    nivel_governanca_accionado: nivel,
    should_block_llm: shouldBlock,
    safe_response: shouldBlock ? buildSafeSilenceResponse(nivel, articleCount) : null,
    rag_article_count: articleCount,
    raw_top_score: rawTopScore,
    has_mozambican_source: hasMozSource,
    has_penalized_source: hasPenalty,
    audit_details: {
      threshold_used: CONFIDENCE_THRESHOLD,
      articles_scores: articlesScores,
      source_flags: sourceFlags,
      trigger_reason: triggerReason,
    },
  };
}

// ─────────────────────────────────────────
// Prompt Enhancer — Cautelar Mode
// ─────────────────────────────────────────

/**
 * Retorna um sufixo de prompt adicional para o modo CAUTELAR.
 * Injecta instruções extra para o LLM ser mais conservador.
 */
export function getCautelarPromptSuffix(): string {
  return `\n\n---\n⚠️ **MODO CAUTELAR ACTIVADO** (Governança V2.0 — Nível 4)\n` +
    `O score de confiança do RAG para esta consulta é MODERADO. Deves:\n` +
    `- Incluir disclaimer explícito em cada afirmação factual\n` +
    `- Recomendar validação profissional no final\n` +
    `- Não citar artigos ou decretos que não estejam directamente no RAG\n` +
    `- Usar linguagem condicional ("possivelmente", "em princípio", "salvo melhor informação")\n` +
    `- Terminar com: ⚠️ *Resposta gerada em modo cautelar — requer validação profissional.*`;
}

// ─────────────────────────────────────────
// Labels e Cores (para UI)
// ─────────────────────────────────────────

export const GOVERNANCE_LEVEL_CONFIG: Record<GovernanceLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  NENHUM: {
    label: 'Sem RAG',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/25',
    description: 'Nenhum documento encontrado no RAG',
  },
  SILENCIO_SEGURO: {
    label: 'Silêncio Seguro',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/25',
    description: 'LLM bloqueado — score abaixo do threshold',
  },
  CAUTELAR: {
    label: 'Cautelar',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/25',
    description: 'Resposta com disclaimer obrigatório',
  },
  CONFIANTE: {
    label: 'Confiante',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/25',
    description: 'Boa cobertura RAG, resposta normal',
  },
  ALTA_CONFIANCA: {
    label: 'Alta Confiança',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/25',
    description: 'Fontes moçambicanas oficiais confirmadas',
  },
};