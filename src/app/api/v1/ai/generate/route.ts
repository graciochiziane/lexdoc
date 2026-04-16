// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Document Generation API
// POST /api/v1/ai/generate — Gerar documentos com IA
// Tipos: contract, petition, legal_opinion, summary, custom_document
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos de geração permitidos
// ─────────────────────────────────────────
const ALLOWED_TYPES = ['contract', 'petition', 'legal_opinion', 'summary', 'custom_document'] as const;

type GenerationType = (typeof ALLOWED_TYPES)[number];

// ─────────────────────────────────────────
// Prompts especializados por tipo de documento
// ─────────────────────────────────────────
function getGenerationSystemPrompt(type: GenerationType): string {
  const basePrompt = `És o LexAssistent, um assistente jurídico virtual especializado no direito moçambicano.
Geras documentos jurídicos profissionais em português de Moçambique (pt-MZ).
Segues as formalidades legais moçambicanas e a linguagem jurídica adequada.
Citas a legislação moçambicana relevante quando aplicável.
Formatas os documentos de forma clara, com estrutura profissional.
ADVERTÊNCIA: Os documentos gerados são informativos e devem ser revistos por um profissional qualificado.`;

  switch (type) {
    case 'contract':
      return `${basePrompt}

TIPO DE DOCUMENTO: CONTRATO / ACORDO

ESTRUTURA OBRIGATÓRIA:
1. TÍTULO — Denominação clara do contrato
2. PREÂMBULO — Identificação das partes (contratante e contratado)
3. CLÁUSULAS:
   - Cláusula 1ª — Objecto do contrato
   - Cláusula 2ª — Obrigações das partes
   - Cláusula 3ª — Prazo e vigência
   - Cláusula 4ª — Remuneração/Preço (se aplicável)
   - Cláusula 5ª — Foro e resolução de litígios
   - Cláusula 6ª — Disposições finais
4. LOCAL E DATA
5. ASSINATURAS

REGRAS:
- Incluir campos [NOME], [BI/NUIT], [ENDEREÇO] para personalização
- Referir a Lei Geral do Trabalho (Lei nº 23/2007) quando aplicável
- Incluir cláusula de foro competente (tribunal da Comarca de Maputo ou outra)
- Indicar a legislação aplicável ao tipo específico de contrato`;

    case 'petition':
      return `${basePrompt}

TIPO DE DOCUMENTO: PETIÇÃO / INITIAL PLEADING

ESTRUTURA OBRIGATÓRIA (Código de Processo Civil moçambicano):
1. CABEÇALHO — Tribunal competente
2. QUALIFICAÇÃO — Identificação do peticionário e do demandado
3. ARTIGOS DE FACTOS — Exposição dos factos (numerados)
4. ARTIGOS DE DIREITO — Fundamentação jurídica com citação de lei
5. PEDIDOS — Conclusões e pedidos ao tribunal
6. VALOR DA CAUSA
7. DATA E ASSINATURA

REGRAS:
- Seguir as regras do CPC moçambicano (Lei nº 1/2013 de 10 de Janeiro)
- Citar artigos de lei específicos
- Incluir [NOME DO TRIBUNAL], [NOME DO JUIZ], [NOME DO PELICOPISTA] para personalização
- Identificar a forma de processo (comum ou especial)
- Incluir o valor da causa quando aplicável`;

    case 'legal_opinion':
      return `${basePrompt}

TIPO DE DOCUMENTO: PARECER JURÍDICO

ESTRUTURA OBRIGATÓRIA:
1. CABEÇALHO — "PARECER JURÍDICO"
2. ASSUNTO — Identificação clara do tema
3. I. QUESTÃO APRESENTADA — Descrição da questão
4. II. ENQUADRAMENTO LEGAL — Legislação e jurisprudência relevantes
5. III. ANÁLISE — Análise detalhada com argumentação
6. IV. CONCLUSÃO — Conclusão e recomendações
7. DATA E ASSINATURA — [NOME DO ADVOGADO], [Nº DA OAM]

REGRAS:
- Analisar a questão sob múltiplas perspectivas jurídicas
- Citar artigos de lei, diplomas legais e jurisprudência
- Apresentar riscos e alternativas
- Formatar com subtítulos claros
- Incluir recomendações práticas`;

    case 'summary':
      return `${basePrompt}

TIPO DE DOCUMENTO: RESUMO JURÍDICO

ESTRUTURA:
1. TÍTULO — Resumo: [Tema]
2. PONTOS PRINCIPAIS — Em bullet points
3. ENQUADRAMENTO LEGAL — Legislação relevante
4. PRAZOS E DATAS RELEVANTES — Se aplicável
5. OBSERVAÇÕES — Notas adicionais

REGRAS:
- Resumir de forma objectiva e clara
- Destacar os pontos mais relevantes
- Identificar prazos e obrigações
- Manter linguagem acessível mas técnica
- Mencionar riscos e atenção`;

    case 'custom_document':
      return `${basePrompt}

TIPO DE DOCUMENTO: DOCUMENTO JURÍDICO PERSONALIZADO

REGRAS:
- Seguir a estrutura solicitada pelo utilizador
- Usar linguagem jurídica formal moçambicana
- Citar legislação relevante
- Formatar de forma profissional e clara
- Incluir campos para personalização quando aplicável`;

    default:
      return basePrompt;
  }
}

// ─────────────────────────────────────────
// Labels em português para os tipos
// ─────────────────────────────────────────
const TYPE_LABELS: Record<GenerationType, string> = {
  contract: 'Contrato',
  petition: 'Petição',
  legal_opinion: 'Parecer Jurídico',
  summary: 'Resumo Jurídico',
  custom_document: 'Documento Personalizado',
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function safeJsonStringify(data: unknown): string | null {
  if (!data) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// POST — Gerar documento com IA
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Rate limiting: 10 pedidos por hora por utilizador ──
    const rateLimit = checkRateLimit(
      `ai:generate:${userId}`,
      10,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Limite de 10 gerações por hora atingido. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // ── Validar body ──
    const body = await request.json().catch(() => null);
    const { type, title, context, process_id, template_id } = body ?? {};

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Tipo inválido. Tipos permitidos: ${ALLOWED_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O título é obrigatório.',
          },
        },
        { status: 400 },
      );
    }

    if (!context || typeof context !== 'string' || context.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O contexto/descrição é obrigatório para gerar o documento.',
          },
        },
        { status: 400 },
      );
    }

    if (context.length > 10000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O contexto não pode exceder 10000 caracteres.',
          },
        },
        { status: 400 },
      );
    }

    const generationType = type as GenerationType;

    // ── Buscar dados do processo se fornecido ──
    let processContext = '';
    if (process_id) {
      const process = await db.legalProcess.findFirst({
        where: {
          id: process_id,
          firm_id: firmId,
        },
        include: {
          client: {
            select: { full_name: true, client_type: true },
          },
        },
      });

      if (process) {
        processContext = `
DADOS DO PROCESSO RELACIONADO:
- Processo: ${process.process_number}
- Título: ${process.title}
- Área: ${process.area}
- Cliente: ${process.client.full_name}
- Tribunal: ${process.court || 'Não especificado'}
- Juiz: ${process.judge || 'Não especificado'}
- Parte contrária: ${process.opposing_party || 'Não especificada'}
- Descrição: ${process.description || 'Sem descrição'}
- Prioridade: ${process.priority}
- Estado: ${process.status}`;
      }
    }

    // ── Buscar template se fornecido ──
    let templateContext = '';
    if (template_id) {
      const template = await db.processTemplate.findFirst({
        where: {
          id: template_id,
          firm_id: firmId,
          is_active: true,
        },
      });

      if (template) {
        templateContext = `
MODELO DE PROCESSO A SEGUIR:
- Título: ${template.title}
- Área: ${template.area}
- Descrição: ${template.description || 'Sem descrição'}
- Lista de verificação: ${template.checklist_items || 'Sem itens'}`;
      }
    }

    // ── Construir prompt de sistema especializado ──
    const systemPrompt = getGenerationSystemPrompt(generationType);

    // ── Construir mensagem do utilizador ──
    let userPrompt = `Gera um documento do tipo "${TYPE_LABELS[generationType]}" com o seguinte título: ${title.trim()}\n\n`;
    userPrompt += `DESCRIÇÃO/CONTEXTO:\n${context.trim()}`;

    if (processContext) {
      userPrompt += `\n\n${processContext}`;
    }

    if (templateContext) {
      userPrompt += `\n\n${templateContext}`;
    }

    userPrompt += `\n\nINSTRUÇÃO: Gera o documento completo seguindo a estrutura obrigatória para o tipo "${TYPE_LABELS[generationType]}". Inclui campos de personalização entre colchetes [ ] onde aplicável.`;

    // ── Chamar LLM ──
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const generatedContent = completion?.choices?.[0]?.message?.content
      ?? 'Erro: Não foi possível gerar o documento. Tente novamente.';

    // ── Guardar geração na base de dados ──
    const generation = await db.aIGeneration.create({
      data: {
        firm_id: firmId,
        user_id: userId,
        generation_type: generationType,
        title: title.trim(),
        prompt: userPrompt,
        result: generatedContent,
        template_id: template_id || null,
        process_id: process_id || null,
        metadata: safeJsonStringify({
          generation_type_label: TYPE_LABELS[generationType],
          context_length: context.length,
          has_process: !!process_id,
          has_template: !!template_id,
        }),
      },
    });

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_DOCUMENT_GENERATED',
      entity_type: 'ai_generation',
      entity_id: generation.id,
      new_values: {
        generation_type: generationType,
        title: title.trim(),
      },
      metadata: {
        result_length: generatedContent.length,
        has_process: !!process_id,
        has_template: !!template_id,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: {
        id: generation.id,
        title: generation.title,
        result: generatedContent,
        generation_type: generationType,
        generation_type_label: TYPE_LABELS[generationType],
        created_at: generation.created_at,
      },
    });
  } catch (error) {
    console.error('[AI Generate] Erro ao gerar documento:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao gerar o documento. Tente novamente.',
        },
      },
      { status: 500 },
    );
  }
}
