// ═══════════════════════════════════════════════════════════════
// LEXDOC — Internet Safe Mode (Camada Bronze do System Orchestrator v3.0)
// Pesquisa web controlada com filtro de jurisdição moçambicana
// ═══════════════════════════════════════════════════════════════

import { chatWithLLM } from './llm';

// ─────────────────────────────────────────
// Tipos
// ═══════════════════════════════════════════════════

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  /** Classificação de prioridade */
  priority: 'alta' | 'média' | 'baixa';
  /** Se a fonte passou no filtro de jurisdição */
  isMozambican: boolean;
}

export interface SafeWebSearchResult {
  /** Se a busca foi realizada */
  searched: boolean;
  /** Resultados filtrados */
  results: WebSearchResult[];
  /** Query usada na busca */
  query: string;
  /** Se resultados foram encontrados */
  hasResults: boolean;
  /** Metadata de auditoria */
  audit: {
    totalRawResults: number;
    filteredOut: number;
    mozambikanCount: number;
    blockedDomains: string[];
  };
}

// ─────────────────────────────────────────
// Filtro de Jurisdição
// ═══════════════════════════════════════════════════

/** Domínios e fontes BLOQUEADOS (jurisdições externas) */
const BLOCKED_DOMAINS = [
  'pt.wikipedia.org', 'pt.', '.pt/',
  'jusbrasil.com.br', 'brasil', 'angola', 'cabo-verde',
  'guine-bissau', 'sao-tome', 'timor-leste',
];

/** Domínios com prioridade ALTA (governamentais moçambicanos) */
const HIGH_PRIORITY_DOMAINS = [
  'brel.gov.mz',        // Boletim da República
  'assembleia.gov.mz',  // Assembleia da República
  'presidencia.gov.mz', // Presidência
  'mef.gov.mz',         // Ministério das Finanças
  'mitrab.gov.mz',      // Ministério do Trabalho
  'mireme.gov.mz',      // Ministério da Justiça
  'inss.gov.mz',        // Segurança Social
  'autt.gov.mz',        // Autoridade Tributária
  'irej.gov.mz',        // Instituto de Registo
  'ctc.gov.mz',         // Centro de Tribunais
  'oam.co.mz',          // Ordem dos Advogados
  'pgr.gov.mz',         // Procuradoria-Geral
  'stj.gov.mz',         // Tribunal Supremo
];

/** Termos de exclusão (para usar na query de busca) */
const EXCLUSION_TERMS = [
  '-portugal', '-brasil', '-angola', '-"diário da república"',
  '-"diario da republica"', '-freguesia', '-concelho',
];

/** Verifica se um domínio está bloqueado */
function isBlockedDomain(url: string): boolean {
  const urlLower = url.toLowerCase();
  return BLOCKED_DOMAINS.some(d => urlLower.includes(d));
}

/** Classifica a prioridade de um resultado */
function classifyPriority(url: string, source?: string): WebSearchResult['priority'] {
  const urlLower = url.toLowerCase();
  const srcLower = (source || '').toLowerCase();

  // Alta prioridade: domínios governamentais MZ
  if (HIGH_PRIORITY_DOMAINS.some(d => urlLower.includes(d))) return 'alta';
  if (srcLower.includes('governo') && srcLower.includes('moçambique')) return 'alta';

  // Média prioridade: .mz ou instituições reconhecidas
  if (urlLower.includes('.mz')) return 'média';
  if (srcLower.includes('universidade') || srcLower.includes('faculty')) return 'média';
  if (srcLower.includes('oam') || srcLower.includes('advogado')) return 'média';

  // Baixa prioridade: todo o resto
  return 'baixa';
}

/** Verifica se um resultado é moçambicano */
function isMozambican(url: string, snippet: string): boolean {
  const combined = (url + ' ' + snippet).toLowerCase();
  return combined.includes('moçambique') || combined.includes('mozambique') || url.includes('.mz');
}

// ─────────────────────────────────────────
// Construção de Query de Busca Segura
// ═══════════════════════════════════════════════════

/**
 * Constrói uma query de busca web segura, priorizando fontes moçambicanas.
 * Adiciona termos de foco em Moçambique e exclusão de outras jurisdições.
 */
export function buildSafeSearchQuery(originalQuery: string, detectedAreas?: string[]): string {
  // Termos de foco moçambicano
  const mozFocus = 'Moçambique legislação moçambicana';
  // Termos de exclusão
  const exclusions = EXCLUSION_TERMS.join(' ');

  // Se há áreas detectadas, adicionar como contexto
  const areaContext = detectedAreas && detectedAreas.length > 0
    ? `direito ${detectedAreas[0].toLowerCase()}`
    : '';

  return `"${originalQuery}" ${mozFocus} ${areaContext} ${exclusions}`.trim();
}

// ─────────────────────────────────────────
// Filtro de Resultados
// ═══════════════════════════════════════════════════

/**
 * Filtra resultados de busca web, removendo fontes bloqueadas
 * e classificando por prioridade.
 */
export function filterWebResults(
  rawResults: Array<{ title: string; snippet: string; url: string }>,
): SafeWebSearchResult {
  const blockedDomains: string[] = [];
  let filteredOut = 0;
  let mozambikanCount = 0;

  const filtered: WebSearchResult[] = rawResults
    .filter(result => {
      // Bloquear domínios de jurisdições externas
      if (isBlockedDomain(result.url)) {
        blockedDomains.push(result.url);
        filteredOut++;
        return false;
      }

      // Bloquear URLs sem protocolo ou suspeitas
      if (!result.url.startsWith('http')) {
        filteredOut++;
        return false;
      }

      return true;
    })
    .map(result => {
      const priority = classifyPriority(result.url, result.title);
      const isMoz = isMozambican(result.url, result.snippet);
      if (isMoz) mozambikanCount++;

      return {
        title: result.title,
        snippet: result.snippet,
        url: result.url,
        priority,
        isMozambican: isMoz,
      };
    })
    // Ordenar: alta prioridade primeiro, depois moçambicanos, depois média, depois baixa
    .sort((a, b) => {
      const priorityOrder = { alta: 0, média: 1, baixa: 2 };
      const aOrder = priorityOrder[a.priority] ?? 3;
      const bOrder = priorityOrder[b.priority] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.isMozambican !== b.isMozambican) return a.isMozambican ? -1 : 1;
      return 0;
    })
    .slice(0, 5); // Máximo 5 resultados

  return {
    searched: true,
    results: filtered,
    query: '',
    hasResults: filtered.length > 0,
    audit: {
      totalRawResults: rawResults.length,
      filteredOut,
      mozambikanCount,
      blockedDomains: [...new Set(blockedDomains)],
    },
  };
}

// ─────────────────────────────────────────
// Busca Web via LLM (fallback quando web-search SDK indisponível)
// ═══════════════════════════════════════════════════

/**
 * Tenta extrair informações relevantes do LLM quando não há busca web disponível.
 * O LLM é instruído a fornecer APENAS informação verificável sobre Moçambique.
 * Esta é uma solução de fallback — não substitui uma busca web real.
 */
export async function llmFallbackSearch(query: string, detectedAreas?: string[]): Promise<SafeWebSearchResult> {
  const areaHint = detectedAreas && detectedAreas.length > 0
    ? `\nÁrea do direito detectada: ${detectedAreas[0]}` : '';

  const prompt = `És um assistente de pesquisa jurídica para Moçambique.

Tarefa: Fornece informações verificáveis e actuais sobre o seguinte tema do direito moçambicano:
"${query}"${areaHint}

REGRAS ESTRICTAS:
1. APENAS informação sobre Moçambique
2. Se não tens informação segura, responde "SEM_INFORMAÇÃO"
3. Indica a fonte se possível (lei, decreto, instituição)
4. Formato: título | resumo (máx 200 palavras) | fonte

Resposta:`;

  try {
    const response = await chatWithLLM([
      { role: 'system', content: 'És um assistente de pesquisa jurídica moçambicana. Responde de forma concisa.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 500 });

    const content = response.content ?? '';

    // Verificar se o LLM não tem informação
    if (content.includes('SEM_INFORMAÇÃO') || content.length < 30) {
      return {
        searched: true,
        results: [],
        query,
        hasResults: false,
        audit: {
          totalRawResults: 0,
          filteredOut: 0,
          mozambikanCount: 0,
          blockedDomains: [],
        },
      };
    }

    // Parsear a resposta do LLM como resultado web
    return {
      searched: true,
      results: [{
        title: `Informação LLM: ${query.substring(0, 60)}`,
        snippet: content.substring(0, 500),
        url: 'lexdoc://llm-fallback',
        priority: 'baixa',
        isMozambican: true,
      }],
      query,
      hasResults: true,
      audit: {
        totalRawResults: 1,
        filteredOut: 0,
        mozambikanCount: 1,
        blockedDomains: [],
      },
    };
  } catch {
    return {
      searched: false,
      results: [],
      query,
      hasResults: false,
      audit: {
        totalRawResults: 0,
        filteredOut: 0,
        mozambikanCount: 0,
        blockedDomains: [],
      },
    };
  }
}