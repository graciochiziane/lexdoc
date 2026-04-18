// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Document Generation API (LexAssistent v1.0)
// POST /api/v1/ai/generate — Gerar documentos com IA
// Tipos: contract, petition, legal_opinion, summary, custom_document,
//        peticao-inicial, contestacao, contrato-trabalho, procuracao,
//        notificacao, requerimento, recurso
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { buildLexAssistGenerationPrompt } from '@/lib/lexassist-prompt';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos de geração permitidos
// ─────────────────────────────────────────
const ALLOWED_TYPES = [
  'contract', 'petition', 'legal_opinion', 'summary', 'custom_document',
  'peticao-inicial', 'contestacao', 'contrato-trabalho', 'procuracao',
  'notificacao', 'requerimento', 'recurso',
] as const;

type GenerationType = (typeof ALLOWED_TYPES)[number];

// ─────────────────────────────────────────
// Labels em português para os tipos
// ─────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato',
  petition: 'Petição',
  'peticao-inicial': 'Petição Inicial',
  contestacao: 'Contestação',
  'contrato-trabalho': 'Contrato de Trabalho',
  procuracao: 'Procuração Forense',
  legal_opinion: 'Parecer Jurídico',
  notificacao: 'Notificação',
  requerimento: 'Requerimento',
  recurso: 'Recurso',
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

    if (!type || !ALLOWED_TYPES.includes(type as GenerationType)) {
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

    // ── Construir prompt de sistema (LexAssistent v1.0) ──
    const systemPrompt = buildLexAssistGenerationPrompt(generationType);

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
