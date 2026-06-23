// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Governança IA (Silêncio Seguro)
// GET /api/v1/platform/governance — Métricas de governança da IA (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { Prisma } from '@prisma/client';

process.env.TZ = 'Africa/Maputo';

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  if (!hasRole(auth.payload.role, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } },
      { status: 403 },
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') ?? '7d';

    // Calcular data de início baseada no período
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // ── Query base: mensagens de assistente com dados de governança ──
    const whereBase: Prisma.AIMessageWhereInput = {
      role: 'assistant',
      created_at: { gte: startDate },
    };

    // Total de respostas no período
    const totalResponses = await db.aIMessage.count({ where: whereBase });

    // Respostas com governança registada (confidence_score não nulo)
    const withGovernance = await db.aIMessage.count({
      where: { ...whereBase, confidence_score: { not: null } },
    });

    // ── Distribuição por nível de governança ──
    const nivelDistribution = await db.aIMessage.groupBy({
      by: ['nivel_governanca_accionado'],
      where: { ...whereBase, nivel_governanca_accionado: { not: null } },
      _count: { nivel_governanca_accionado: true },
    });

    // ── Silêncio Seguro: contagem de bloqueios ──
    const safeSilenceCount = await db.aIMessage.count({
      where: {
        ...whereBase,
        nivel_governanca_accionado: { in: ['NENHUM', 'SILENCIO_SEGURO'] },
      },
    });

    // ── Taxa de silêncio seguro (% do total) ──
    const safeSilenceRate = totalResponses > 0
      ? Math.round((safeSilenceCount / totalResponses) * 100)
      : 0;

    // ── Score médio de confiança ──
    const avgConfidence = await db.aIMessage.aggregate({
      where: { ...whereBase, confidence_score: { not: null } },
      _avg: { confidence_score: true },
      _min: { confidence_score: true },
      _max: { confidence_score: true },
    });

    // ── Distribuição de score por faixas ──
    const scoreBuckets = await Promise.all([
      db.aIMessage.count({
        where: { ...whereBase, confidence_score: { gte: 0, lt: 10 } },
      }),
      db.aIMessage.count({
        where: { ...whereBase, confidence_score: { gte: 10, lt: 25 } },
      }),
      db.aIMessage.count({
        where: { ...whereBase, confidence_score: { gte: 25, lt: 50 } },
      }),
      db.aIMessage.count({
        where: { ...whereBase, confidence_score: { gte: 50, lt: 75 } },
      }),
      db.aIMessage.count({
        where: { ...whereBase, confidence_score: { gte: 75 } },
      }),
    ]);

    // ── Respostas com e sem fonte moçambicana (via metadata) ──
    const recentWithMeta = await db.aIMessage.findMany({
      where: { ...whereBase, metadata: { not: null } },
      select: { metadata: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    let withMozSource = 0;
    let withPenalizedSource = 0;
    let withNoSource = 0;
    for (const msg of recentWithMeta) {
      try {
        const meta = JSON.parse(msg.metadata || '{}');
        const audit = meta.governance_audit;
        if (audit) {
          if (audit.source_flags?.includes('fonte-mz')) withMozSource++;
          if (audit.source_flags?.includes('fonte-pt-penalizada')) withPenalizedSource++;
          if (audit.source_flags?.includes('sem-fonte')) withNoSource++;
        }
      } catch {
        // ignore parse errors
      }
    }

    // ── Últimas 20 respostas com governança (para tabela) ──
    const recentGovernance = await db.aIMessage.findMany({
      where: { ...whereBase, confidence_score: { not: null } },
      select: {
        id: true,
        content: true,
        confidence_score: true,
        nivel_governanca_accionado: true,
        created_at: true,
        conversation: {
          select: {
            title: true,
            user: { select: { full_name: true, email: true } },
            firm: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    // ── Tendência diária (últimos 14 dias) ──
    const dailyTrend = await db.$queryRaw<Array<{
      date: string;
      total: bigint;
      safe_silence: bigint;
      avg_confidence: number | null;
    }>>`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE nivel_governanca_accionado IN ('NENHUM', 'SILENCIO_SEGURO')) as safe_silence,
        AVG(confidence_score) as avg_confidence
      FROM ai_messages
      WHERE role = 'assistant'
        AND created_at >= ${startDate}
        AND confidence_score IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 14
    `;

    return NextResponse.json({
      success: true,
      data: {
        period,
        summary: {
          total_responses: totalResponses,
          with_governance_data: withGovernance,
          governance_coverage: totalResponses > 0
            ? Math.round((withGovernance / totalResponses) * 100)
            : 0,
          safe_silence_count: safeSilenceCount,
          safe_silence_rate,
          avg_confidence_score: avgConfidence._avg.confidence_score ?? null,
          min_confidence_score: avgConfidence._min.confidence_score ?? null,
          max_confidence_score: avgConfidence._max.confidence_score ?? null,
        },
        nivel_distribution: nivelDistribution.map((n) => ({
          nivel: n.nivel_governanca_accionado,
          count: n._count.nivel_governanca_accionado,
          percentage: totalResponses > 0
            ? Math.round((n._count.nivel_governanca_accionado / totalResponses) * 100)
            : 0,
        })),
        score_distribution: {
          '0-9 (Crítico)': scoreBuckets[0],
          '10-24 (Baixo)': scoreBuckets[1],
          '25-49 (Médio)': scoreBuckets[2],
          '50-74 (Bom)': scoreBuckets[3],
          '75-100 (Alto)': scoreBuckets[4],
        },
        source_analysis: {
          with_mozambican_source: withMozSource,
          with_penalized_source: withPenalizedSource,
          with_no_source: withNoSource,
          sample_size: recentWithMeta.length,
        },
        daily_trend: dailyTrend.map((d) => ({
          date: d.date,
          total: Number(d.total),
          safe_silence: Number(d.safe_silence),
          avg_confidence: d.avg_confidence ? Math.round(d.avg_confidence) : null,
        })),
        recent_governance: recentGovernance.map((r) => ({
          id: r.id,
          conversation_title: r.conversation.title,
          user_name: r.conversation.user?.full_name ?? '—',
          firm_name: r.conversation.firm?.name ?? '—',
          confidence_score: r.confidence_score,
          nivel: r.nivel_governanca_accionado,
          content_preview: r.content.substring(0, 120) + (r.content.length > 120 ? '...' : ''),
          created_at: r.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('[PLATFORM_GOVERNANCE] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}