// ═══════════════════════════════════════════════════════════════
// LEXDOC — Base de Conhecimento Jurídico: Estatísticas
// GET /api/v1/knowledge/stats — Estatísticas da base de conhecimento
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Estatísticas da base de conhecimento
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  const firmId = payload.firm_id;

  try {
    const now = new Date();

    // Consultas paralelas
    const [
      totalArticles,
      pinnedArticles,
      totalViews,
      articlesByCategory,
      recentArticles,
      mostViewedArticles,
    ] = await Promise.all([
      // Total de artigos
      db.knowledgeArticle.count({
        where: { firm_id: firmId },
      }),

      // Artigos fixados
      db.knowledgeArticle.count({
        where: { firm_id: firmId, is_pinned: true },
      }),

      // Total de visualizações
      db.knowledgeArticle.aggregate({
        where: { firm_id: firmId },
        _sum: { view_count: true },
      }),

      // Artigos por categoria
      db.knowledgeArticle.groupBy({
        by: ['category'],
        where: { firm_id: firmId },
        _count: { id: true },
      }),

      // Últimos 5 artigos criados
      db.knowledgeArticle.findMany({
        where: { firm_id: firmId },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          view_count: true,
          created_at: true,
          created_by: {
            select: { full_name: true },
          },
        },
      }),

      // 5 artigos mais vistos
      db.knowledgeArticle.findMany({
        where: { firm_id: firmId },
        orderBy: { view_count: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          view_count: true,
        },
      }),
    ]);

    // Formatar contagem por categoria
    const byCategory: Record<string, number> = {};
    for (const item of articlesByCategory) {
      byCategory[item.category] = item._count.id;
    }

    return NextResponse.json({
      success: true,
      data: {
        total_articles: totalArticles,
        pinned_articles: pinnedArticles,
        total_views: totalViews._sum.view_count ?? 0,
        by_category: byCategory,
        recent_articles: recentArticles,
        most_viewed: mostViewedArticles,
      },
    });
  } catch (error) {
    console.error('[KNOWLEDGE STATS] Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor. Tente novamente mais tarde.',
        },
      },
      { status: 500 }
    );
  }
}
