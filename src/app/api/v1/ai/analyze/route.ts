// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Document Analysis API (LexAssistent)
// POST /api/v1/ai/analyze — Analisar texto jurídico com IA
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { chatWithLLM, getProviderInfo } from '@/lib/llm';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos de análise aceites
// ┐══════════════════════════════════════════════════════════════
const VALID_TYPES = ['contract', 'petition', 'legal_opinion', 'general'] as const;
type AnalysisType = (typeof VALID_TYPES)[number];

const TYPE_LABELS: Record<AnalysisType, string> = {
  contract: 'Contrato',
  petition: 'Petição / Peça Processual',
  legal_opinion: 'Parecer Jurídico',
  general: 'Documento Geral',
};

// ─────────────────────────────────────────
// System prompt para análise de documentos
// ─────────────────────────────────────────
function buildAnalysisPrompt(type: AnalysisType): string {
  return `És o LexAssistent, um assistente jurídico virtual especializado no direito moçambicano. O utilizador enviou um documento do tipo "${TYPE_LABELS[type]}" para análise.

INSTRUÇÕES DE ANÁLISE:
1. Lê atentamente o documento fornecido.
2. Produz uma análise estruturada em português de Moçambique (pt-MZ).
3. A análise DEVE conter as seguintes secções, claramente identificadas:

## Resumo
Um resumo conciso do documento (2-3 parágrafos).

## Pontos-Chave
Lista de 3-7 pontos principais do documento, em bullet points.

## Riscos Identificados
Lista de potenciais riscos jurídicos, lacunas ou problemas no documento. Se não houver, indica "Nenhum risco significativo identificado."

## Recomendações
Lista de recomendações práticas para melhorar o documento ou acções a tomar.

REGRAS:
- Baseia-te na legislação moçambicana vigente.
- Cita diplomas legais relevantes quando aplicável.
- Sê objectivo e profissional.
- Formata a resposta de forma clara e organizada.
- Se o texto for demasiado curto ou insuficiente para análise, informa o utilizador.`;
}

// ─────────────────────────────────────────
// POST — Analisar documento
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Rate limiting: 20 pedidos por hora por utilizador ──
    const rateLimit = checkRateLimit(
      `ai:analyze:${userId}`,
      20,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Limite de 20 análises por hora atingido. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // ── Validar body ──
    const body = await request.json().catch(() => null);
    const { text, type } = body ?? {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O texto do documento é obrigatório.',
          },
        },
        { status: 400 },
      );
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Tipo de análise inválido. Tipos aceites: ${VALID_TYPES.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    if (text.length > 30000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O texto não pode exceder 30.000 caracteres.',
          },
        },
        { status: 400 },
      );
    }

    // ── Construir prompt e chamar LLM via adapter unificado ──
    const analysisType = type as AnalysisType;
    const systemPrompt = buildAnalysisPrompt(analysisType);
    const providerInfo = getProviderInfo();

    const completion = await chatWithLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text.trim() },
    ], {
      temperature: 0.5,
      maxTokens: 4096,
    });

    const rawAnalysis = completion.content ?? 'Não foi possível analisar o documento. Tente novamente.';

    // ── Tentar extrair secções da resposta ──
    const summary = extractSection(rawAnalysis, 'Resumo');
    const keyPoints = extractBulletPoints(extractSection(rawAnalysis, 'Pontos-Chave') ?? extractSection(rawAnalysis, 'Pontos-chave') ?? '');
    const risks = extractBulletPoints(extractSection(rawAnalysis, 'Riscos Identificados') ?? extractSection(rawAnalysis, 'Riscos') ?? '');
    const recommendations = extractBulletPoints(extractSection(rawAnalysis, 'Recomendações') ?? '');

    const analysisData = {
      summary: summary ?? rawAnalysis.substring(0, 500),
      key_points: keyPoints.length > 0 ? keyPoints : [rawAnalysis.substring(0, 200)],
      risks: risks.length > 0 ? risks : ['Não foram identificados riscos significativos.'],
      recommendations: recommendations.length > 0 ? recommendations : ['Revise o documento com um advogado especializado.'],
      full_analysis: rawAnalysis,
    };

    // ── Guardar análise na base de dados ──
    const analysisGenType = `analysis_${type}` as string;
    const generation = await db.aIGeneration.create({
      data: {
        firm_id: firmId,
        user_id: userId,
        generation_type: analysisGenType,
        title: `Análise: ${TYPE_LABELS[analysisType]}`,
        prompt: text.trim().substring(0, 10000),
        result: rawAnalysis,
        metadata: JSON.stringify({
          analysis_type: type,
          text_length: text.length,
          structured: analysisData,
        }),
      },
    });

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_DOCUMENT_ANALYSIS',
      entity_type: 'ai_generation',
      entity_id: generation.id,
      new_values: { generation_type: analysisGenType, title: generation.title },
      metadata: {
        analysis_type: type,
        text_length: text.length,
        analysis_length: rawAnalysis.length,
        llm_provider: providerInfo.provider,
        llm_model: providerInfo.model,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: analysisData,
    });
  } catch (error) {
    console.error('[AI Analyze] Erro ao analisar documento:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao analisar o documento. Tente novamente.',
        },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// Funções auxiliares para parse da resposta
// ─────────────────────────────────────────

function extractSection(text: string, sectionName: string): string | null {
  // Tenta encontrar a secção por diferentes formatos de header
  const patterns = [
    new RegExp(`##\\s*${escapeRegex(sectionName)}[\\s]*\\n([\\s\\S]*?)(?=##|$)`, 'i'),
    new RegExp(`#${escapeRegex(sectionName)}[\\s]*\\n([\\s\\S]*?)(?=##|#|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

function extractBulletPoints(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
