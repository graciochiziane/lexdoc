// ═══════════════════════════════════════════════════════════════
// LEXDOC — Relatórios API
// GET /api/v1/reports/overview — Dados abrangentes do escritório
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

export async function GET(request: Request) {
  // ── Autenticação ──
  const authResult = authenticateRequest(request as Parameters<typeof authenticateRequest>[0]);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  // ── RBAC: ADMIN ou ADVOGADO ──
  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } },
      { status: 403 },
    );
  }

  const firmId = payload.firm_id;

  try {
    // ── Paralelizar queries ──
    const [
      firmData,
      processCounts,
      clientCounts,
      documentCounts,
      deadlineCounts,
      activityData,
    ] = await Promise.all([
      // 1. Dados do escritório
      db.firm.findUnique({
        where: { id: firmId },
        select: {
          name: true,
          plan: true,
          created_at: true,
          _count: { select: { users: true } },
        },
      }),

      // 2. Processos — contagens por estado, área, prioridade, mês
      db.legalProcess.findMany({
        where: { firm_id: firmId },
        select: {
          status: true,
          area: true,
          priority: true,
          created_at: true,
        },
      }),

      // 3. Clientes — contagens por tipo
      db.client.findMany({
        where: { firm_id: firmId },
        select: {
          client_type: true,
          created_at: true,
        },
      }),

      // 4. Documentos — contagens por estado, tamanho total
      db.document.findMany({
        where: { firm_id: firmId },
        select: {
          status: true,
          file_size: true,
          is_confidential: true,
        },
      }),

      // 5. Prazos — contagens por estado
      db.deadline.findMany({
        where: {
          process: { firm_id: firmId },
        },
        select: {
          status: true,
          due_date: true,
        },
      }),

      // 6. Actividade — audit logs e utilizadores
      db.auditLog.findMany({
        where: { firm_id: firmId },
        select: {
          action: true,
          user_id: true,
        },
        orderBy: { created_at: 'desc' },
        take: 1000,
      }),
    ]);

    // ── Calcular data actual em Maputo ──
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // ── Process data: Processes ──
    const processesByArea: Record<string, number> = { CIVIL: 0, CRIMINAL: 0, LABORAL: 0, COMERCIAL: 0, FAMILIA: 0, OUTRO: 0 };
    const processesByPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    let processActive = 0, processSuspended = 0, processClosed = 0;
    let thisMonthProcesses = 0, lastMonthProcesses = 0;
    const monthCounts: Record<string, number> = {};

    for (const p of processCounts) {
      // By status
      if (p.status === 'ACTIVE') processActive++;
      else if (p.status === 'SUSPENDED') processSuspended++;
      else if (p.status === 'CLOSED' || p.status === 'ARCHIVED') processClosed++;

      // By area
      const area = p.area.toUpperCase();
      if (processesByArea[area] !== undefined) processesByArea[area]++;
      else processesByArea['OUTRO']++;

      // By priority
      const prio = p.priority.toUpperCase();
      if (processesByPriority[prio] !== undefined) processesByPriority[prio]++;
      else processesByPriority['MEDIUM']++;

      // By month
      const mKey = `${p.created_at.getFullYear()}-${String(p.created_at.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[mKey] = (monthCounts[mKey] || 0) + 1;

      // This/last month
      if (p.created_at >= thisMonthStart) thisMonthProcesses++;
      else if (p.created_at >= lastMonthStart && p.created_at < thisMonthStart) lastMonthProcesses++;
    }

    // Average per month
    const uniqueMonths = Object.keys(monthCounts).length || 1;
    const avgPerMonth = Math.round(processCounts.length / uniqueMonths);

    // ── Process data: Clients ──
    const clientsByType: Record<string, number> = { INDIVIDUAL: 0, EMPRESA: 0, GOVERNO: 0, ONG: 0 };
    let newClientsThisMonth = 0;

    for (const c of clientCounts) {
      const t = c.client_type.toUpperCase();
      if (clientsByType[t] !== undefined) clientsByType[t]++;
      else clientsByType['INDIVIDUAL']++;

      if (c.created_at >= thisMonthStart) newClientsThisMonth++;
    }

    // ── Process data: Documents ──
    const documentsByStatus: Record<string, number> = { DRAFT: 0, FINAL: 0, ARCHIVED: 0 };
    let totalFileSize = 0;
    let confidentialCount = 0;

    for (const d of documentCounts) {
      const st = d.status.toUpperCase();
      if (documentsByStatus[st] !== undefined) documentsByStatus[st]++;
      else documentsByStatus['DRAFT']++;

      totalFileSize += d.file_size;
      if (d.is_confidential) confidentialCount++;
    }

    // ── Process data: Deadlines ──
    let deadlineOverdue = 0, deadlineCompleted = 0, deadlineUpcoming7d = 0, deadlineUpcoming30d = 0;

    for (const d of deadlineCounts) {
      if (d.status === 'COMPLETED') {
        deadlineCompleted++;
      } else {
        if (d.due_date < now) deadlineOverdue++;
        else if (d.due_date <= next7Days) deadlineUpcoming7d++;
        else if (d.due_date <= next30Days) deadlineUpcoming30d++;
      }
    }

    // ── Process data: Activity ──
    const userActionCounts: Record<string, number> = {};
    const actionsByType: Record<string, number> = { CREATE: 0, UPDATE: 0, DELETE: 0, LOGIN_SUCCESS: 0 };

    for (const a of activityData) {
      // By user
      if (a.user_id) {
        userActionCounts[a.user_id] = (userActionCounts[a.user_id] || 0) + 1;
      }

      // By type
      if (a.action.startsWith('CREATE')) actionsByType['CREATE']++;
      else if (a.action.startsWith('UPDATE') || a.action.startsWith('PATCH')) actionsByType['UPDATE']++;
      else if (a.action.startsWith('DELETE')) actionsByType['DELETE']++;
      else if (a.action === 'LOGIN_SUCCESS') actionsByType['LOGIN_SUCCESS']++;
    }

    // Top 5 most active users
    const topUserIds = Object.entries(userActionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let mostActiveUsers: Array<{ name: string; actions_count: number }> = [];
    if (topUserIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: topUserIds }, firm_id: firmId },
        select: { id: true, full_name: true },
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
      mostActiveUsers = topUserIds
        .map((id) => ({
          name: userMap[id] || 'Desconhecido',
          actions_count: userActionCounts[id],
        }))
        .filter((u) => u.name !== 'Desconhecido');
    }

    // ── Firm age in days ──
    const firmAgeDays = firmData?.created_at
      ? Math.floor((now.getTime() - new Date(firmData.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        firm: {
          name: firmData?.name ?? '',
          plan: firmData?.plan ?? 'STARTER',
          member_count: firmData?._count?.users ?? 0,
          created_at: firmData?.created_at?.toISOString() ?? '',
          age_days: firmAgeDays,
        },
        processes: {
          total: processCounts.length,
          active: processActive,
          suspended: processSuspended,
          closed: processClosed,
          by_area: processesByArea,
          by_priority: processesByPriority,
          avg_per_month: avgPerMonth,
          this_month: thisMonthProcesses,
          last_month: lastMonthProcesses,
        },
        clients: {
          total: clientCounts.length,
          by_type: clientsByType,
          new_this_month: newClientsThisMonth,
        },
        documents: {
          total: documentCounts.length,
          by_status: documentsByStatus,
          total_size_bytes: totalFileSize,
          confidential_count: confidentialCount,
        },
        deadlines: {
          total: deadlineCounts.length,
          overdue: deadlineOverdue,
          completed: deadlineCompleted,
          upcoming_7d: deadlineUpcoming7d,
          upcoming_30d: deadlineUpcoming30d,
        },
        activity: {
          total_audit_entries: activityData.length,
          most_active_users: mostActiveUsers,
          recent_actions_by_type: actionsByType,
        },
      },
    });
  } catch (error) {
    console.error('[Reports API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar relatório.' } },
      { status: 500 },
    );
  }
}
