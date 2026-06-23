// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Generation Detail API
// GET    /api/v1/ai/generate/[id] — Obter geração completa
// DELETE /api/v1/ai/generate/[id] — Eliminar geração
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';

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
// GET — Obter geração completa
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;
    const { id } = await params;

    // ── Buscar geração ──
    const generation = await db.aIGeneration.findFirst({
      where: {
        id,
        user_id: userId,
        firm_id: firmId,
      },
      select: {
        id: true,
        generation_type: true,
        title: true,
        prompt: true,
        result: true,
        process_id: true,
        template_id: true,
        metadata: true,
        created_at: true,
      },
    });

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Geração não encontrada.',
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: generation.id,
        generation_type: generation.generation_type,
        generation_type_label: TYPE_LABELS[generation.generation_type] || generation.generation_type,
        title: generation.title,
        prompt: generation.prompt,
        result: generation.result,
        process_id: generation.process_id,
        template_id: generation.template_id,
        metadata: generation.metadata ? JSON.parse(generation.metadata) : null,
        created_at: generation.created_at,
      },
    });
  } catch (error) {
    console.error('[AI Generation Detail] Erro ao obter geração:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao obter geração.',
        },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// DELETE — Eliminar geração
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;
    const { id } = await params;

    // ── Verificar se a geração existe e pertence ao utilizador ──
    const generation = await db.aIGeneration.findFirst({
      where: {
        id,
        user_id: userId,
        firm_id: firmId,
      },
    });

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Geração não encontrada.',
          },
        },
        { status: 404 },
      );
    }

    // ── Eliminar geração ──
    await db.aIGeneration.delete({
      where: { id },
    });

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_GENERATION_DELETED',
      entity_type: 'ai_generation',
      entity_id: id,
      old_values: {
        generation_type: generation.generation_type,
        title: generation.title,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        message: 'Geração eliminada com sucesso.',
      },
    });
  } catch (error) {
    console.error('[AI Generation Detail] Erro ao eliminar geração:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao eliminar geração.',
        },
      },
      { status: 500 },
    );
  }
}
