// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Generations List API
// GET /api/v1/ai/generate/list — Listar gerações IA do utilizador
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Labels em português para os tipos
// ─────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato',
  petition: 'Petição',
  legal_opinion: 'Parecer Jurídico',
  summary: 'Resumo Jurídico',
  document: 'Documento',
  custom_document: 'Documento Personalizado',
  'peticao-inicial': 'Petição Inicial',
  contestacao: 'Contestação',
  'contrato-trabalho': 'Contrato de Trabalho',
  procuracao: 'Procuração Forense',
  notificacao: 'Notificação',
  requerimento: 'Requerimento',
  recurso: 'Recurso',
  'analysis_contract': 'Análise de Contrato',
  'analysis_petition': 'Análise de Petição',
  'analysis_legal_opinion': 'Análise de Parecer',
  'analysis_general': 'Análise Geral',
};

// ─────────────────────────────────────────
// GET — Listar gerações
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Paginação ──
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);

    // ── Filtros ──
    const where: Record<string, unknown> = {
      user_id: userId,
      firm_id: firmId,
    };

    // Filtro por tipo
    const typeFilter = searchParams.get('type');
    if (typeFilter) {
      where.generation_type = typeFilter;
    }

    // ── Contar total ──
    const total = await db.aIGeneration.count({ where });

    // ── Buscar gerações ──
    const generations = await db.aIGeneration.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        generation_type: true,
        title: true,
        prompt: true,
        result: true,
        process_id: true,
        template_id: true,
        created_at: true,
      },
    });

    // ── Formatar resposta ──
    const formatted = generations.map((gen) => ({
      id: gen.id,
      generation_type: gen.generation_type,
      generation_type_label: TYPE_LABELS[gen.generation_type] || gen.generation_type,
      title: gen.title,
      prompt_preview: gen.prompt.substring(0, 150) + (gen.prompt.length > 150 ? '...' : ''),
      result_preview: gen.result.substring(0, 200) + (gen.result.length > 200 ? '...' : ''),
      process_id: gen.process_id,
      template_id: gen.template_id,
      created_at: gen.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[AI Generate List] Erro ao listar gerações:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao listar gerações.',
        },
      },
      { status: 500 },
    );
  }
}
