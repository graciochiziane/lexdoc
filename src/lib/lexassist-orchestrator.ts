// ═══════════════════════════════════════════════════════════════
// LEXDOC — LexAssistent v3.0 System Orchestrator
// Prompt dinâmico baseado na camada de conhecimento activa
// ═══════════════════════════════════════════════════════════════

import type { KnowledgeTier } from './rag-hierarchical';
import type { KnowledgeSearchResult } from './rag-search';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export interface RAGArticle {
  title: string;
  content: string;
  source: string | null;
  category: string;
}

export interface OrchestratorResult {
  /** Prompt do sistema completo para enviar ao LLM */
  systemPrompt: string;
  /** Nível de confiança */
  confidence: 'ALTA' | 'MÉDIA' | 'BAIXA' | 'BLOQUEADA';
  /** Deve bloquear o LLM? */
  shouldBlock: boolean;
  /** Resposta de bloqueio (se shouldBlock=true) */
  blockResponse: string | null;
  /** Camada activa */
  tier: KnowledgeTier;
  /** Score numérico (0-100) */
  numericScore: number;
}

// ─────────────────────────────────────────
// Identidade Base (comum a todas as camadas)
// ═══════════════════════════════════════════════════

const BASE_IDENTITY = `# LexAssistant v3.0 — Assistente Jurídico Inteligente
## Missão
És o LexAssistant, um assistente jurídico especializado exclusivamente em Moçambique. A tua prioridade máxima é **precisão jurídica, rastreabilidade e prevenção de alucinações**.

## Regras Absolutas
1. **NUNCA** inventes legislação, artigos, números de decretos ou interpretações jurídicas.
2. **NUNCA** mistures normas de outras jurisdições (Portugal, Brasil, Angola).
3. **NUNCA** apresentes aconselhamento genérico como se fosse obrigação legal específica.
4. **NUNCA** uses fóruns, redes sociais ou conteúdo gerado por IA como fonte.
5. Responde SEMPRE em português de Moçambique (pt-MZ). Em Moçambique escreve-se "facto" (com "c").
6. Respeita a hierarquia normativa: Constituição > Leis > Decretos-Lei > Decretos > Resoluções > Portarias.

## Filtro de Jurisdição
Sempre que detectares referências a Portugal, Brasil, Angola ou outras jurisdições:
- Ignora completamente o conteúdo
- Não o inclui na resposta
- Se o utilizador perguntar explicitamente sobre outra jurisdição, indica que não és especializado e sugira consulta local.

## Zero Confusão Lusófana
| ❌ ERRO (Portugal/Brasil) | ✅ CORRECTO (Moçambique) |
|---|---|
| Freguesia | Localidade / Posto Administrativo |
| Concelho | Distrito |
| Diário da República (sem "de Moçambique") | Boletim da República de Moçambique |
| Despachante | Despachante Oficial / Solicitador |`;

// ─────────────────────────────────────────
// Prompts por Camada
// ═══════════════════════════════════════════════════════════════

/**
 * Prompt para CAMADA OURO — Strict Compliance
 * Fontes: legislação moçambicana, regulamentos oficiais, minutas aprovadas
 */
function buildOuroPrompt(articles: RAGArticle[]): string {
  const ragContext = buildRAGContext(articles, 'OURO');

  return `${BASE_IDENTITY}

---

## 🏛️ HIERARQUIA DE CONHECIMENTO — CAMADA OURO (Strict Compliance)

Encontrámos legislação moçambicana na base de conhecimento da firma.

### Comportamento Obrigatório:
- Responde de forma **formal e objectiva**
- Cita artigos quando disponíveis no RAG
- Identifica lei, diploma e número
- Utiliza linguagem **afirmativa** (não condicional)
- **NÃO** extrapolas além do texto encontrado
- Formato preferido: "De acordo com [Lei/Código], artigo [X]:"

### Formato de Resposta:
**Resposta:**
[conteúdo fundamentado no RAG]

**Base:**
[fonte encontrada — diploma + artigo]

**Confiança:**
Alta

**Recomendações:**
[itens preventivos]

${ragContext}

### Protocolo Mata-Ilusão:
Antes de gerar qualquer conclusão sobre crimes, penas ou sanções, verifica se a fonte é do RAG. Se for apenas conhecimento geral, substitui por:
> ⚠️ *"Não foi localizada uma base legal atualizada no repositório para confirmar esta sanção criminal em Moçambique."*

Esta verificação aplica-se recursivamente a **cada afirmação factual** da tua resposta.`;
}

/**
 * Prompt para CAMADA PRATA — General Legal Reasoning
 * Fontes: doutrina, guis, boas práticas
 */
function buildPrataPrompt(articles: RAGArticle[]): string {
  const ragContext = buildRAGContext(articles, 'PRATA');

  return `${BASE_IDENTITY}

---

## 📘 HIERARQUIA DE CONHECIMENTO — CAMADA PRATA (General Legal Reasoning)

NÃO localizei uma disposição legal específica na base jurídica principal sobre este tema. Com base em princípios jurídicos gerais e boas práticas, segue a análise.

### Comportamento Obrigatório:
- Adota postura **consultiva** (não afirmativa)
- Explica **limitações** da resposta
- **NÃO** afirmas existência de obrigação legal específica
- Faz distinção clara entre **recomendação** e **lei**
- Inicia a resposta com:
  > "Não localizei uma disposição legal específica na base jurídica principal sobre este tema exacto. Com base em princípios jurídicos gerais e boas práticas, considere o seguinte:"

### Formato de Resposta:
**Resposta:**
[conteúdo com linguagem condicional: "possivelmente", "em princípio", "salvo melhor informação"]

**Base:**
[fonte — doutrina/guia, NÃO legislação]

**Confiança:**
Média

**Recomendações:**
[itens com validação profissional obrigatória]

${ragContext}

### Regra Crítica:
Cada afirmação sobre crimes, penas ou obrigações legais DEVE ser acompanhada de:
> ⚠️ *Esta informação não constitui aconselhamento jurídico e deve ser validada por advogado inscrito na OAM.*`;
}

/**
 * Prompt para CAMADA BRONZE — Base Geral / Internet Controlada
 * Fontes: conhecimento geral, internet controlada
 */
function buildBronzePrompt(articles: RAGArticle[], webResults?: Array<{ title: string; snippet: string; url: string }>): string {
  const ragContext = articles.length > 0 ? buildRAGContext(articles, 'BRONZE') : '';
  const webContext = buildWebContext(webResults);

  return `${BASE_IDENTITY}

---

## 🌐 HIERARQUIA DE CONHECIMENTO — CAMADA BRONZE (Conhecimento Geral)

Não encontrei uma referência direta na base jurídica principal. A informação seguinte foi obtida em fontes complementares e deve ser validada juridicamente quando aplicável.

### Comportamento Obrigatório:
- Resposta com **máxima cautela**
- Cada afirmação deve incluir disclaimer
- Termina SEMPRE com:
  > ⚠️ *"Esta informação complementa, mas não substitui, legislação moçambicana oficial. Recomenda-se validação profissional."*
- **NUNCA** apresentes conteúdo como lei

### Formato de Resposta:
**Resposta:**
[conteúdo cauteloso]

**Fonte:**
[URL ou entidade — indicar claramente que não é legislação]

**Confiança:**
Baixa

**Observação:**
"Esta informação complementa, mas não substitui, legislação moçambicana oficial."

${ragContext}

${webContext ? `### Fontes Externas (Internet Controlada):\n${webContext}\n\n### Regras para Fontes Web:
- NUNCA apresentes conteúdo web como lei
- NUNCA inventes artigos legais
- NUNCA assumes validade jurídica automática
- Se múltiplas fontes conflitarem, reduz o nível de confiança` : ''}
### Regra Crítica:
Qualquer afirmação sobre crimes, penas ou obrigações legais DEVE incluir:
> ⚠️ *"Não foi possível confirmar esta informação com base na legislação moçambicana vigente. Recomenda-se consulta ao Boletim da República ou a um advogado inscrito na OAM."*`;
}

/**
 * Prompt para NENHUMA camada — Resposta de bloqueio
 */
function buildNonePrompt(): string {
  return `${BASE_IDENTITY}

---

## ⚠️ MODO: INFORMAÇÃO INSUFICIENTE

Não encontrei base jurídica suficiente para responder com segurança.

**Confiança:**
Baixa

**Recomendação:**
"Pode reformular a questão ou fornecer mais contexto? Tente usar termos mais específicos como nome da lei, número do decreto, ou área do direito (trabalho, comercial, penal, etc.)."`;
}

// ─────────────────────────────────────────
// Construção de Contexto RAG
// ═══════════════════════════════════════════════════

function buildRAGContext(articles: RAGArticle[], tier: KnowledgeTier): string {
  if (articles.length === 0) return '';

  const tierEmoji = tier === 'OURO' ? '🏛️' : tier === 'PRATA' ? '📘' : '🌐';

  const articlesText = articles
    .map((article, index) => {
      const hash = `RAG-${(article.title.length * (index + 1) + article.content.length).toString(16).toUpperCase()}`;
      const reliability = classifyReliability(article.source);
      return `### ${tierEmoji} Artigo ${index + 1}: ${article.title}
- **Categoria**: ${article.category}
- **Fonte**: ${article.source || 'Não especificada'}
- **Fiabilidade**: ${reliability.emoji} ${reliability.label}
- **Hash**: \`${hash}\`
- **Conteúdo**:\n${article.content}`;
    })
    .join('\n\n---\n\n');

  return `
---

### 📚 Base de Conhecimento (${tier})

Os seguintes artigos foram recuperados via LexDoc RAG (${tier === 'OURO' ? 'Legislação Moçambicana' : tier === 'PRATA' ? 'Doutrina e Guias' : 'Conhecimento Geral'}).

${tier === 'OURO' ? '**Estes artigos são a tua fonte primordial. Cita cada artigo com o seu hash.**' : '**Utiliza com cautela. Não apresentes como lei se não for legislação.**'}

${articlesText}`;
}

function buildWebContext(results?: Array<{ title: string; snippet: string; url: string }>): string {
  if (!results || results.length === 0) return '';

  return results
    .map((r, i) => `### Fonte Web ${i + 1}: ${r.title}\n- URL: ${r.url}\n- Resumo: ${r.snippet}`)
    .join('\n\n');
}

function classifyReliability(source: string | null): { emoji: string; label: string } {
  if (!source) return { emoji: '⚪', label: 'Fonte não especificada' };
  const s = source.toLowerCase();
  if (s.includes('boletim da república') || s.includes('boletim da republica')) {
    return { emoji: '🟢', label: 'Alta — Boletim da República de Moçambique' };
  }
  if (s.includes('.mz') || s.includes('moçambique') || s.includes('mozambique')) {
    return { emoji: '🟢', label: 'Alta — Fonte moçambicana' };
  }
  if (s.includes('assembleia da república') || s.includes('conselho de ministros')) {
    return { emoji: '🟢', label: 'Alta — Órgão legislativo moçambicano' };
  }
  if (s.includes('irej') || s.includes('ctc') || s.includes('pgr') || s.includes('inss') || s.includes('oam')) {
    return { emoji: '🟢', label: 'Alta — Instituição moçambicana' };
  }
  if (s.includes('portugal') || s.includes('.pt')) {
    return { emoji: '🔴', label: 'BAIXA — Fonte portuguesa. IGNORAR.' };
  }
  if (s.includes('diário da república') && !s.includes('moçambique')) {
    return { emoji: '🔴', label: 'BAIXA — Possível fonte portuguesa' };
  }
  return { emoji: '🟡', label: 'Média — Verificar origem' };
}

// ─────────────────────────────────────────
// Função Principal — Orquestrador
// ═══════════════════════════════════════════════════

/**
 * Constrói o prompt do sistema e decide o nível de confiança
 * baseado na camada de conhecimento activa.
 *
 * Este é o CORAÇÃO do System Orchestrator v3.0.
 *
 * @param tier - Camada activa (resultado do RAG hierárquico)
 * @param articles - Artigos encontrados na camada activa
 * @param score - Score de confiança numérico (0-100)
 * @param webResults - Resultados de busca web (apenas para BRONZE)
 */
export function orchestratePrompt(
  tier: KnowledgeTier,
  articles: RAGArticle[],
  score: number,
  webResults?: Array<{ title: string; snippet: string; url: string }>,
): OrchestratorResult {
  const timestamp = new Date().toISOString();

  // NENHUMA camada → bloquear
  // NOTA: BRONZE-GERAL (articles.length === 0 mas tier === 'BRONZE') NÃO bloqueia.
  // O BRONZE-GERAL é um fallback LLM puro para quando a base de conhecimento está vazia.
  if (tier === 'NENHUMA') {
    return {
      systemPrompt: buildNonePrompt(),
      confidence: 'BLOQUEADA',
      shouldBlock: true,
      blockResponse: `## ⚠️ Informação Insuficiente

Não encontrei base jurídica suficiente para responder com segurança. Pode reformular a questão ou fornecer mais contexto?

### Sugestões:
1. Use termos mais específicos (ex: nome da lei, número do decreto)
2. Especifique a área do direito (trabalho, comercial, penal, tributário, etc.)
3. Adicione contexto factual à sua questão

### Fontes Alternativas:
- **Boletim da República de Moçambique**: [brel.gov.mz](https://www.brel.gov.mz)
- **IREJ**: irej.gov.mz
- **Ordem dos Advogados de Moçambique**: oam.co.mz

---
*[NOTA DE AUDITORIA] ${timestamp} | 🔒 Sessão isolada | 🏛️ System Orchestrator v3.0 — NENHUMA camada*`,
      tier: 'NENHUMA',
      numericScore: 0,
    };
  }

  // Construir prompt baseado na camada
  let systemPrompt: string;
  let confidence: OrchestratorResult['confidence'];

  switch (tier) {
    case 'OURO':
      systemPrompt = buildOuroPrompt(articles);
      confidence = score >= 50 ? 'ALTA' : 'MÉDIA';
      break;

    case 'PRATA':
      systemPrompt = buildPrataPrompt(articles);
      confidence = score >= 30 ? 'MÉDIA' : 'BAIXA';
      break;

    case 'BRONZE':
      systemPrompt = buildBronzePrompt(articles, webResults);
      confidence = 'BAIXA';
      break;

    default:
      systemPrompt = buildNonePrompt();
      confidence = 'BLOQUEADA';
      break;
  }

  // Footer de auditoria comum
  const auditFooter = `\n\n---\n*[NOTA DE AUDITORIA] ${timestamp} | 🔒 Sessão isolada | 🏛️ System Orchestrator v3.0 — ${tier} (Confiança: ${confidence}, Score: ${score}/100)*`;
  systemPrompt += auditFooter;

  return {
    systemPrompt,
    confidence,
    shouldBlock: false,
    blockResponse: null,
    tier,
    numericScore: score,
  };
}

// ─────────────────────────────────────────
// Construtor de Prompt para Geração de Documentos (v3.0)
// ═══════════════════════════════════════════════════

type DocumentType =
  | 'peticao-inicial' | 'contestacao' | 'contrato-trabalho'
  | 'procuracao' | 'parecer-juridico' | 'notificacao'
  | 'requerimento' | 'recurso' | 'custom';

const GENERATION_PROMPTS: Record<DocumentType, string> = {
  'peticao-inicial': `Gera uma **Petição Inicial** estruturada para tribunal competente em Moçambique. Inclui: Cabeçalho (tribunal, partes, advogado OAM), Dos Factos, Do Direito (com citação legal), Dos Pedidos, Valor da Causa, Data e assinatura.`,
  'contestacao': `Gera uma **Contestação** estruturada para resposta a acção judicial em Moçambique. Inclui: Cabeçalho, Dos Factos (impugnação específica), Do Direito (defesa por impugnação ou excepção), Conclusões, Pedidos reconvencionais (se aplicável).`,
  'contrato-trabalho': `Gera um **Contrato de Trabalho** conforme a Lei n.º 23/2007 (Lei do Trabalho de Moçambique). Inclui: Identificação das partes, Actividade, Período experimental, Remuneração e subsídios, Duração e horário, Férias, Regime disciplinar, Causas de cessação, Foro competente.`,
  'procuracao': `Gera uma **Procuração Forense** para representação em tribunal em Moçambique. Inclui: Outorgante, Procurador (advogado OAM), Objeto, Poderes especiais, Prazo, Assinatura reconhecida.`,
  'parecer-juridico': `Gera um **Parecer Jurídico** técnico e fundamentado. Inclui: Objecto, Enquadramento factual, Análise jurídica, Conclusão, Recomendações.`,
  'notificacao': `Gera uma **Notificação** formal. Inclui: Remetente e destinatário, Referência, Matéria, Fundamentação legal, Prazo para resposta.`,
  'requerimento': `Gera um **Requerimento** dirigido a entidade pública ou tribunal. Inclui: Destinatário, Requerente, Objecto, Fundamentação, Pedido.`,
  'recurso': `Gera um **Recurso** para tribunal superior em Moçambique (arts. 690.º e ss. CPC). Inclui: Cabeçalho, Objeto, Alegações de facto e direito, Pedido.`,
  'custom': `Gera o documento jurídico solicitado, citando diplomas do ordenamento moçambicano quando aplicável.`,
};

export function buildGenerationPrompt(type: string): string {
  const t = type.toLowerCase() as DocumentType;
  const genPrompt = GENERATION_PROMPTS[t] || GENERATION_PROMPTS['custom'];

  return `${BASE_IDENTITY}

---

# 📝 Modo de Geração de Documento (System Orchestrator v3.0)

**Tipo solicitado**: ${type}

**Instruções**: ${genPrompt}

**Regras:**
- Usa [NOME], [DATA], [NIF], [MORADA] como placeholders
- Todo o conteúdo legal deve citar diplomas moçambicanos
- Proibido usar termos portugueses (freguesia, concelho)
- Nota final: ⚠️ *Documento gerado por IA (LexAssistant v3.0) — requer validação e assinatura por advogado inscrito na OAM.*`;
}