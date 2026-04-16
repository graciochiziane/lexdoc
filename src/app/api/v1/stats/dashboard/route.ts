// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel Estatístico
// GET /api/v1/stats/dashboard — Estatísticas do escritório
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Dashboard stats
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  const firmId = payload.firm_id;

  try {
    const now = new Date();

    // Consultas paralelas de contagem — todas filtradas por firm_id
    const [
      totalProcesses,
      activeProcesses,
      totalClients,
      totalDocuments,
      upcomingDeadlines,
      overdueDeadlines,
      recentLogs,
      recentDeadlines,
    ] = await Promise.all([
      // Total de processos
      db.legalProcess.count({
        where: { firm_id: firmId },
      }),

      // Processos activos
      db.legalProcess.count({
        where: { firm_id: firmId, status: 'ACTIVE' },
      }),

      // Total de clientes
      db.client.count({
        where: { firm_id: firmId },
      }),

      // Total de documentos
      db.document.count({
        where: { firm_id: firmId },
      }),

      // Prazos futuros pendentes
      db.deadline.count({
        where: {
          process: { firm_id: firmId },
          due_date: { gt: now },
          status: 'PENDING',
        },
      }),

      // Prazos vencidos pendentes
      db.deadline.count({
        where: {
          process: { firm_id: firmId },
          due_date: { lt: now },
          status: 'PENDING',
        },
      }),

      // Últimas 10 actividades de auditoria do escritório
      db.auditLog.findMany({
        where: { firm_id: firmId },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entity_type: true,
          entity_id: true,
          created_at: true,
          user_id: true,
        },
      }),

      // Últimos 5 prazos pendentes futuros com dados do processo
      db.deadline.findMany({
        where: {
          process: { firm_id: firmId },
          due_date: { gt: now },
          status: 'PENDING',
        },
        include: {
          process: {
            select: {
              title: true,
              process_number: true,
            },
          },
        },
        orderBy: { due_date: 'asc' },
        take: 5,
      }),
    ]);

    // Buscar nomes dos utilizadores para as actividades recentes
    const userIds = [...new Set(recentLogs.map((log) => log.user_id).filter(Boolean))] as string[];
    const userMap = new Map<string, string>();

    if (userIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true },
      });

      for (const user of users) {
        userMap.set(user.id, user.full_name);
      }
    }

    // Formatar actividades recentes
    const recentActivities = recentLogs.map((log) => ({
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      created_at: log.created_at,
      user_name: log.user_id ? (userMap.get(log.user_id) ?? 'Desconhecido') : 'Sistema',
    }));

    // Formatar prazos recentes com dados do processo
    const formattedRecentDeadlines = recentDeadlines.map((d) => ({
      id: d.id,
      title: d.title,
      due_date: d.due_date,
      process: {
        title: d.process.title,
        process_number: d.process.process_number,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        total_processes: totalProcesses,
        active_processes: activeProcesses,
        total_clients: totalClients,
        total_documents: totalDocuments,
        upcoming_deadlines: upcomingDeadlines,
        overdue_deadlines: overdueDeadlines,
        recent_activities: recentActivities,
        recent_deadlines: formattedRecentDeadlines,
      },
    });
  } catch (error) {
    console.error('[STATS DASHBOARD] Erro interno:', error);
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
