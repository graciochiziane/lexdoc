// ═══════════════════════════════════════════════════════════════
// LEXDOC — Query Rewriter + Taxonomia Jurídica Moçambicana
// Traduz linguagem informal → termos jurídicos + expansão semântica
// Fase 1 do System Orchestrator v3.0
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export interface RewrittenQuery {
  /** Query original do utilizador (não modificada para display) */
  original: string;
  /** Query expandida com sinónimos para pesquisa RAG */
  expanded: string;
  /** Lista de termos jurídicos extraídos da expansão */
  legalTerms: string[];
  /** Taxonomia detectada (áreas do direito) */
  detectedAreas: string[];
}

// ─────────────────────────────────────────
// Dicionário de Sinónimos Jurídicos MZ
// Mapeia termos informais → termos jurídicos equivalentes
// ═══════════════════════════════════════════════════

/** Mapa: termo informal → termos jurídicos equivalentes */
const LEGAL_SYNONYMS: Record<string, string[]> = {
  // ── Sociedade / Empresarial ──
  'aplicativo': ['software', 'plataforma digital', 'aplicação informática', 'sistema informático'],
  'app': ['software', 'aplicação informática', 'plataforma digital'],
  'sócio': ['acionista', 'parceiro empresarial', 'sócio-gerente', 'quotista', 'comanditado'],
  'sócios': ['acionistas', 'parceiros empresariais', 'quotistas'],
  'parceria': ['contrato de colaboração', 'associação em participação', 'joint venture', 'consórcio'],
  'empresa': ['sociedade comercial', 'pessoa colectiva', 'entidade patronal', 'empregador'],
  'negócio': ['actividade empresarial', 'operações comerciais', 'transacção comercial'],
  'contrato': ['acordo contratual', 'convenção', 'pacto'],
  'freelancer': ['prestador de serviços', 'trabalhador independente', 'profissional liberal'],
  'consultor': ['prestador de serviços', 'contratado', 'assessor'],
  'comissão': ['remuneração variável', 'honorários proporcionais', 'percentagem'],
  'investidor': ['sócio capitalista', 'accionista', 'financiador', 'subscritor'],
  'startup': ['sociedade startup', 'empresa de base tecnológica', 'PME inovadora'],
  'funcionário': ['trabalhador', 'empregado', 'assalariado'],
  'chefe': ['empregador', 'entidade patronal', 'sócio-gerente'],
  'demissão': ['despedimento', 'cessação do contrato de trabalho', 'rescisão'],
  'despedimento': ['resolução pelo empregador', 'cessação do contrato', 'dispensa'],
  'salário': ['remuneração', 'retribuição', 'vencimento'],
  'férias': ['período de férias', 'descanso anual remunerado'],
  'horas extra': ['trabalho suplementar', 'trabalho extraordinário', 'horas acrescidas'],
  'aviso prévio': ['pré-aviso', 'notificação prévia', 'denúncia do contrato'],

  // ── Propriedade Intelectual ──
  'marca': ['propriedade industrial', 'registo de marca', 'sinal distintivo'],
  'patente': ['propriedade industrial', 'invenção', 'privilégio de invenção'],
  'direitos autorais': ['propriedade intelectual', 'direito de autor', 'copyright'],
  'plágio': ['violação de direitos de autor', 'contrafacção', 'usurpação'],
  'domínio': ['nome de domínio', 'registo DNS', 'propriedade digital'],

  // ── Imobiliário ──
  'casa': ['imóvel', 'prédio urbano', 'habitação', 'unidade habitacional'],
  'terreno': ['prédio rústico', 'parcela de terreno', 'gleba', 'lote de terreno'],
  'aluguel': ['renda', 'arrendamento', 'contrato de arrendamento urbano'],
  'aluguer': ['renda', 'arrendamento', 'contrato de arrendamento urbano'],
  'inquilino': ['arrendatário', 'senhorio', 'titular do direito de arrendamento'],
  'senhorio': ['senhorio', 'proprietário do imóvel arrendado', 'arrendante'],
  'escritura': ['escritura pública', 'escritura notarial', 'título de aquisição'],
  'escritura pública': ['escritura notarial', 'instrumento notarial', 'título autêntico'],

  // ── Família / Sucessões ──
  'divórcio': ['dissolução do casamento', 'separação judicial', 'divórcio por mútuo consentimento'],
  'pensão alimentícia': ['obrigação de alimentos', 'prestação de alimentos', 'fixação de alimentos'],
  'herança': ['sucessão', 'partilha', 'inventário', 'acervo hereditário'],
  'testamento': ['disposição testamentária', 'testamento cerrado', 'testamento público'],
  'guarda': ['responsabilidade parental', 'guarda de menores', 'poder paternal'],
  'casamento': ['matrimónio', 'união de facto', 'regime de bens'],

  // ── Tributário ──
  'imposto': ['tributo', 'obrigação fiscal', 'incidência tributária'],
  'factura': ['factura electrónica', 'documento de cobrança', 'fatura'],
  'fatura': ['factura electrónica', 'documento de cobrança'],
  'IVA': ['imposto sobre o valor acrescentado', 'IVA moçambicano', 'CIVA'],
  'IRPS': ['imposto sobre o rendimento de pessoas singulares', 'retenção na fonte', 'IRS moçambicano'],
  'IRPC': ['imposto sobre o rendimento de pessoas colectivas', 'IRC moçambicano'],
  'tributação': ['incidência fiscal', 'obrigações acessórias', 'deveres fiscais'],

  // ── Trabalho ──
  'recisão': ['rescisão do contrato', 'denúncia', 'revogação'],
  'justa causa': ['justo motivo', 'faltas disciplinares', 'incumprimento grave'],
  'trabalhador': ['empregado', 'assalariado', 'prestador subordinado'],
  'segurança social': ['INSS', 'Instituto Nacional de Segurança Social', 'protecção social'],
  'acidente de trabalho': ['sinistro laboral', 'lesão por acidente de trabalho', 'seguro de acidentes'],
  'processo disciplinar': ['procedimento disciplinar', 'instrução disciplinar', 'processo de inquérito'],

  // ── Processual ──
  'processo': ['acção judicial', 'demandado', 'processo judicial', 'litígio'],
  'juiz': ['magistrado judicial', 'tribunal competente', 'órgão jurisdicional'],
  'advogado': ['patrono', 'mandatário judicial', 'advogado inscrito na OAM'],
  'recurso': ['meio de impugnação', 'apelação', 'revista', 'recurso de revisão'],
  'petição': ['petição inicial', 'articulado', 'peça processual', 'distribuição'],
  'contestação': ['resposta à petição', 'defesa', 'articulado de defesa'],
  'citação': ['notificação judicial', 'mandado de citação', 'citação edital'],
  'notificação': ['acto de comunicação processual', 'citação', 'intimação'],
  'penhora': ['execução fiscal', 'garantia patrimonial', 'arresto', 'sequestro'],
  'embargo': ['oposição à execução', 'embargo de terceiro', 'meio de defesa'],
  'foro': ['tribunal competente', 'jurisdição', 'competência material e territorial'],

  // ── Penal ──
  'crime': ['ilícito criminal', 'infração penal', 'tipo legal de crime'],
  'prisão': ['medida de coacção', 'pena de prisão', 'detenção'],
  'multa': ['coima', 'sanção pecuniária', 'pena de multa'],
  'queixa': ['denúncia', 'participação criminal', 'queixa-crime'],
  'habeas corpus': ['habeas corpus', 'liberdade individual', 'medida de coacção ilegal'],

  // ── Comercial / Contratos ──
  'garantia': ['caução', 'hipoteca', 'penhor', 'fiança', 'seguro de garantia'],
  'juros': ['remuneração do capital', 'taxa de juro', 'anatocismo', 'usura'],
  'dívida': ['obrigação pecuniária', 'crédito', 'título executivo'],
  'pagamento': ['cumprimento da obrigação', 'extinção da obrigação', 'satisfação do crédito'],
  'incumprimento': ['mora', 'inadimplemento', 'violação contratual', 'cláusula resolutiva'],
};

// ─────────────────────────────────────────
// Taxonomia de Áreas do Direito MZ
// Mapeia palavras-chave → área jurídica
// ═══════════════════════════════════════════════════

const AREA_TAXONOMY: Record<string, string[]> = {
  'Direito do Trabalho': ['trabalho', 'empregador', 'empregado', 'trabalhador', 'salário', 'remuneração',
    'férias', 'despedimento', 'contrato de trabalho', 'segurança social', 'inss', 'acidente de trabalho',
    'processo disciplinar', 'horas extra', 'subsidio', 'subsídio', 'irps', 'retenção', 'sindicato',
    'greve', 'lay-off', 'redução', 'contratação colectiva', 'ct'],
  'Direito Comercial': ['sociedade', 'sócio', 'quotista', 'acionista', 'capital social', 'empresa',
    'nome comercial', 'estabelecimento', 'fusão', 'cisão', 'transformação', 'dissolução', 'liquidação',
    'consórcio', 'joint venture', 'franchising', 'franchisamento', 'agência', 'distribuição',
    'comissão', 'comercial', 'registro', 'registo comercial', 'irej'],
  'Direito Civil': ['contrato', 'obrigação', 'responsabilidade civil', 'danos', 'indemnização',
    'propriedade', 'posse', 'usucapião', 'servidão', 'hipoteca', 'penhor', 'renda', 'arrendamento',
    'compra e venda', 'doação', 'mútuo', 'empréstimo', 'mandato', 'procuração', 'fiança',
    'testamento', 'sucessão', 'herança', 'divórcio', 'casamento', 'filiação', 'adopção', 'alimentos'],
  'Direito Penal': ['crime', 'pena', 'prisão', 'multa', 'culpa', 'dolo', 'homicídio', 'roubo',
    'furto', 'fraude', 'corrupção', 'branqueamento', 'tráfico', 'droga', 'violência', 'abuso',
    'coacção', 'difamação', 'injúria', 'queixa', 'denúncia', 'habeas corpus', 'prescrição'],
  'Direito Tributário': ['imposto', 'iva', 'irps', 'irpc', 'tributo', 'factura', 'fatura',
    'tributação', 'autoridade tributária', 'isenção', 'dedução', 'retenção', 'contribuição',
    'taxa', 'emolumento', 'custas', 'sisa', 'imposto de selo', 'matriz', 'ciu'],
  'Direito Administrativo': ['administração pública', 'acto administrativo', 'licença', 'alvará',
    'autorização', 'concurso público', 'funcionário público', 'serviço público', 'desapropriação',
    'expropriação', 'contencioso administrativo', 'tribunal administrativo'],
  'Direito da Propriedade Intelectual': ['marca', 'patente', 'direito de autor', 'copyright',
    'propriedade intelectual', 'software', 'domínio', 'plágio', 'licença', 'royalty', 'registo',
    'inpi', 'industrial', 'desenho', 'modelo de utilidade'],
  'Direito Processual': ['processo', 'petição', 'contestação', 'recurso', 'apelação', 'revista',
    'juiz', 'tribunal', 'advogado', 'citação', 'notificação', 'penhora', 'embargo', 'execução',
    'prova', 'testemunha', 'perícia', 'sentença', 'acórdão', 'despacho', 'diligência',
    'prazo', 'prescrição', 'caducidade', 'competência', 'cpc'],
};

// ─────────────────────────────────────────
// GATE 0 — Classificação de Intenção
// Detecta mensagens conversacionais antes do pipeline RAG
// Saudações, despedidas, agradecimentos, perguntas sobre o assistente
// ═══════════════════════════════════════════════════

/**
 * Set de termos jurídicos para protecção contra falsos positivos.
 * Se a mensagem contém QUALQUER destes termos (matching exacto por palavra),
 * NÃO é classificada como conversacional — vai para o pipeline RAG.
 *
 * IMPORTANTE: Usar Set (O(1) lookup), NÃO substring matching.
 * "pela" NÃO matcheia "penhora" porque split por espaços.
 */
function buildLegalVocabSet(): Set<string> {
  const terms: string[] = [
    // Processual
    'processo', 'acção', 'petição', 'contestação', 'recurso', 'apelação', 'revista',
    'juiz', 'tribunal', 'advogado', 'sentença', 'acórdão', 'despacho', 'diligência',
    'citação', 'notificação', 'penhora', 'embargo', 'execução', 'prazo', 'prescrição',
    // Civil / Contratos
    'contrato', 'obrigação', 'responsabilidade', 'danos', 'indemnização', 'propriedade',
    'hipoteca', 'penhor', 'renda', 'arrendamento', 'compra', 'venda', 'doação',
    'testamento', 'sucessão', 'herança', 'divórcio', 'casamento', 'filiação',
    // Trabalho
    'trabalho', 'empregador', 'empregado', 'trabalhador', 'salário', 'remuneração',
    'férias', 'despedimento', 'segurança', 'social', 'inss', 'disciplinar',
    'subsídio', 'sindicato', 'greve', 'contratação',
    // Comercial
    'sociedade', 'sócio', 'capital', 'empresa', 'fusão', 'quotista', 'acionista',
    'franchising', 'consórcio', 'comissão', 'comercial', 'registo',
    // Penal
    'crime', 'pena', 'prisão', 'multa', 'culpa', 'dolo', 'homicídio', 'roubo',
    'furto', 'fraude', 'corrupção', 'violência', 'abuso', 'difamação',
    // Tributário
    'imposto', 'iva', 'irps', 'irpc', 'tributo', 'factura', 'fatura', 'tributação',
    // PI
    'marca', 'patente', 'copyright', 'propriedade', 'intelectual', 'plágio',
    // Administrativo
    'administração', 'pública', 'licença', 'alvará', 'funcionário',
    // Legislação genérica
    'lei', 'decreto', 'artigo', 'código', 'regulamento', 'constituição', 'diploma',
    'boletim', 'república', 'direito', 'jurídico', 'legal', 'justiça', 'advocacia',
    'oam', 'ordem', 'advogados', 'moçambique', 'mozambique',
  ];
  return new Set(terms);
}

const LEGAL_VOCAB = buildLegalVocabSet();

/**
 * Detecta se uma mensagem é CONVERSACIONAL (não jurídica).
 *
 * Lógica:
 * 1. Mensagens ≤5 palavras sem termos jurídicos → verifica padrões de conversação
 * 2. Mensagens >5 palavras → SEMPRE verifica termos jurídicos primeiro
 *    (se contém qualquer termo jurídico, NÃO é conversacional)
 *
 * Retorna true se for conversacional (bypass RAG), false se for potencialmente jurídica.
 */
export function isConversationalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;

  const words = trimmed.split(/\s+/);
  const wordCount = words.length;

  // PASSO 1: Verificar se contém termos jurídicos (protecção contra falsos positivos)
  // Se SIM → não é conversacional, vai para RAG
  const msgLower = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const word of words) {
    const normalized = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    if (normalized.length > 2 && LEGAL_VOCAB.has(normalized)) {
      return false; // Contém termo jurídico → pipeline RAG
    }
  }

  // PASSO 2: Verificar padrões de conversação
  if (wordCount <= 5) {
    return isConversationalShort(msgLower);
  }

  // Mensagens longas sem termos jurídicos → NÃO é conversacional (pode ser query complexa)
  return false;
}

/**
 * Verifica se uma mensagem curta (≤5 palavras) é conversacional.
 * Usa padrões regex precisos — sem substring matching perigoso.
 */
function isConversationalShort(normalized: string): boolean {
  const patterns: Array<RegExp> = [
    // Saudações
    /^oi\b/i,
    /^ola\b/i,
    /^olá\b/i,
    /^hey\b/i,
    /^(bom dia|boa tarde|boa noite|boa\s*(manha|manhã|tarde|noite))\b/i,
    /^(tudo bem|estás bem|está bem|como estás|como está)\b/i,
    /^e ai\b/i,
    /^e aí\b/i,
    /^(saludos|saudações)\b/i,

    // Despedidas
    /^(tchau|adeus|até|até logo|ate logo|bye|goodbye)\b/i,
    /^até (logo|amanhã|amanha|breve|já|ja)\b/i,

    // Agradecimentos
    /^(obrigado|obrigada|valeu|thanks|gracias|agradeço)\b/i,
    /^muito obrigad/i,
    /^thanks\b/i,

    // Respostas curtas
    /^(sim|nao|não|ok|certo|entendido|combinado|concordo|claro|exato)\b$/i,
    /^(talvez|provavelmente|possivelmente)\b$/i,

    // Perguntas sobre o assistente (sem termos jurídicos)
    /^(quem és tu|quem é você|quem e voce|o que és|o que você faz|o que voce faz)\b/i,
    /^(como funciona|como usar|ajuda|help|o que podes fazer|o que pode fazer)\b/i,
    /^(quais (são|sao) as tuas|quais sao tuas)\b/i,

    // Cumprimentos genéricos
    /^(bem-vindo|bem vindo|benvindo)\b/i,
    /^hello\b/i,
    /^hi\b/i,
  ];

  return patterns.some(pattern => pattern.test(normalized));
}

/**
 * Retorna o prompt do sistema para respostas conversacionais.
 * Resposta directa, curta, simpática, profissional.
 */
export function getConversationalPrompt(): string {
  return `# LexAssistant v3.0 — Assistente Jurídico Inteligente de Moçambique

És o LexAssistant, um assistente jurídico especializado em Moçambique.

REGRAS PARA ESTA RESPOSTA:
1. A mensagem do utilizador é CONVERSACIONAL (saudação, despedida, etc.).
2. Responde de forma BREVE (máx 2-3 frases), simpática e profissional.
3. NÃO entres em detalhes jurídicos.
4. Se o utilizador perguntar o que podes fazer, menciona brevemente:
   - Consulta de legislação moçambicana
   - Análise de questões jurídicas
   - Geração de documentos jurídicos
   - Gestão de processos e prazos
5. Responde SEMPRE em português de Moçambique (pt-MZ).
6. Se o utilizador quiser ajuda jurídica, sugere que formule a sua questão.`;
}

// ─────────────────────────────────────────
// Função principal — Query Rewriter
// ═══════════════════════════════════════════════════

/**
 * Expande a query do utilizador com sinónimos jurídicos.
 * Não altera a query original — apenas adiciona termos para pesquisa.
 * Não mostra esta reescrita ao utilizador (transparente).
 *
 * Pipeline:
 * 1. Normaliza a query (lowercase, remove acentos)
 * 2. Encontra termos informais no dicionário de sinónimos
 * 3. Adiciona os equivalentes jurídicos à query expandida
 * 4. Detecta áreas do direito baseado nas palavras
 * 5. Se query for informal (não encontrou termos jurídicos),
 *    adiciona termos da área detectada como reforço
 */
export function rewriteQuery(originalQuery: string): RewrittenQuery {
  const normalized = normalizeForMatch(originalQuery);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);

  const expandedTerms = new Set<string>();
  const legalTerms: string[] = [];
  const detectedAreas: string[] = [];

  // 1. Buscar sinónimos para cada palavra da query
  for (const word of words) {
    // Busca exacta no dicionário
    if (LEGAL_SYNONYMS[word]) {
      const synonyms = LEGAL_SYNONYMS[word];
      legalTerms.push(...synonyms);
      for (const syn of synonyms) {
        expandedTerms.add(syn);
      }
      expandedTerms.add(word);
    } else {
      // Busca parcial (se a palavra contém uma chave do dicionário)
      for (const [informal, juridicos] of Object.entries(LEGAL_SYNONYMS)) {
        if (word.includes(informal) || informal.includes(word)) {
          legalTerms.push(...juridicos);
          for (const j of juridicos) {
            expandedTerms.add(j);
          }
        }
      }
      // Mantém a palavra original
      expandedTerms.add(word);
    }
  }

  // 2. Detectar áreas do direito
  const queryLower = originalQuery.toLowerCase();
  for (const [area, keywords] of Object.entries(AREA_TAXONOMY)) {
    for (const kw of keywords) {
      if (queryLower.includes(kw)) {
        detectedAreas.push(area);
        break; // Uma área por iteração, não duplicar
      }
    }
  }

  // 3. Se não encontrou termos jurídicos, adicionar reforço da área detectada
  if (legalTerms.length === 0 && detectedAreas.length > 0) {
    const area = detectedAreas[0];
    const areaKeywords = AREA_TAXONOMY[area];
    // Adicionar até 5 termos-chave da área como reforço
    const reinforcementTerms = areaKeywords.slice(0, 5);
    for (const term of reinforcementTerms) {
      expandedTerms.add(term);
    }
  }

  // 4. Construir query expandida (original + termos expandidos)
  const originalWords = originalQuery.trim().split(/\s+/);
  const expandedArray = [...originalWords, ...Array.from(expandedTerms)];
  const expanded = [...new Set(expandedArray)].join(' ');

  return {
    original: originalQuery.trim(),
    expanded,
    legalTerms: [...new Set(legalTerms)],
    detectedAreas: [...new Set(detectedAreas)],
  };
}

// ─────────────────────────────────────────
// Funções auxiliares
// ═══════════════════════════════════════

/** Normalizar texto para matching (lowercase, sem acentos, sem pontuação) */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gera o prompt de reescrita de query via LLM (opcional, para queries complexas).
 * Este é um fallback para quando a expansão por dicionário não é suficiente.
 * A chamada ao LLM é feita apenas quando o score de confiança do dicionário é baixo.
 */
export function buildQueryRewritePrompt(query: string): string {
  return `És um tradutor de linguagem informal para terminologia jurídica moçambicana.

Tarefa: Traduz a seguinte pergunta do utilizador para uma versão com termos jurídicos precisos do direito moçambicano.

REGRAS:
1. Não alteres a intenção da pergunta
2. Substitui termos informais por equivalentes jurídicos moçambicanos
3. Adiciona termos de taxonomia relevantes
4. Mantém o foco em Moçambique
5. NÃO inventes contexto que não exista na pergunta original
6. Retorna APENAS a frase reescrita, sem explicações

Pergunta original: "${query}"

Frase reescrita (termos jurídicos moçambicanos):`;
}

/**
 * Decide se é necessário usar o LLM para reescrita (fallback).
 * Usa o dicionário primeiro; só chama LLM se o dicionário não encontrou termos suficientes.
 */
export function needsLLMRewrite(rewritten: RewrittenQuery): boolean {
  // Se encontrou termos jurídicos suficientes no dicionário, não precisa de LLM
  if (rewritten.legalTerms.length >= 3) return false;
  // Se detectou área do direito, também é suficiente
  if (rewritten.detectedAreas.length >= 1) return false;
  // Query curta sem contexto → beneficiaria de LLM rewrite
  if (rewritten.original.split(/\s+/).length <= 3) return true;
  // Query longa sem termos jurídicos → pode precisar de LLM
  return true;
}