// ═══════════════════════════════════════════════════════════════
// LEXDOC — Platform: Estatísticas Globais
// GET /api/v1/platform/stats — Visão geral da plataforma (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';

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
    const [
      totalFirms,
      activeFirms,
      totalUsers,
      activeUsers,
      totalClients,
      totalProcesses,
      activeProcesses,
      totalDocuments,
      totalDeadlines,
      pendingDeadlines,
      totalConversations,
      totalGenerations,
      recentUsers,
      recentFirms,
    ] = await Promise.all([
      // Escritórios
      db.firm.count(),
      db.firm.count({ where: { is_active: true } }),

      // Utilizadores
      db.user.count(),
      db.user.count({ where: { is_active: true } }),

      // Clientes
      db.client.count(),

      // Processos
      db.legalProcess.count(),
      db.legalProcess.count({ where: { status: 'ACTIVE' } }),

      // Documentos
      db.document.count(),

      // Prazos
      db.deadline.count(),
      db.deadline.count({ where: { status: 'PENDING' } }),

      // IA
      db.aIConversation.count(),
      db.aIGeneration.count(),

      // Dados recentes
      db.user.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true, email: true, full_name: true, role: true,
          created_at: true,
          firm: { select: { name: true } },
        },
      }),
      db.firm.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: { id: true, name: true, plan: true, is_active: true, created_at: true },
      }),
    ]);

    // Distribuição de roles
    const roleDistribution = await db.user.groupBy({
      by: ['role'],
      _count: { role: true },
      orderBy: { _count: { role: 'desc' } },
    });

    // Distribuição de planos
    const planDistribution = await db.firm.groupBy({
      by: ['plan'],
      _count: { plan: true },
      orderBy: { _count: { plan: 'desc' } },
    });

    return NextResponse.json({
      success: true,
      data: {
        firms: {
          total: totalFirms,
          active: activeFirms,
          inactive: totalFirms - activeFirms,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          by_role: roleDistribution.map((r) => ({
            role: r.role,
            count: r._count.role,
          })),
        },
        clients: { total: totalClients },
        processes: {
          total: totalProcesses,
          active: activeProcesses,
          closed: totalProcesses - activeProcesses,
        },
        documents: { total: totalDocuments },
        deadlines: {
          total: totalDeadlines,
          pending: pendingDeadlines,
        },
        ai: {
          conversations: totalConversations,
          generations: totalGenerations,
        },
        plans: planDistribution.map((p) => ({
          plan: p.plan,
          count: p._count.plan,
        })),
        recent: {
          users: recentUsers,
          firms: recentFirms,
        },
      },
    });
  } catch (error) {
    console.error('[PLATFORM_STATS] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}