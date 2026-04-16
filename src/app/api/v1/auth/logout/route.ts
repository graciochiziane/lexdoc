// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Logout (Terminar Sessão)
// POST /api/v1/auth/logout
// Revoga o refresh token (se fornecido) e regista evento de auditoria
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAccessToken, hashToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Verificar access token ──
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    let userFirmId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      if (decoded) {
        userId = decoded.sub;
        userFirmId = decoded.firm_id;
      }
    }

    // ── Revogar refresh token se fornecido ──
    const body = await request.json().catch(() => ({}));
    const { refresh_token } = body as { refresh_token?: string };

    if (refresh_token) {
      const tokenHash = await hashToken(refresh_token);

      // Buscar e revogar o token
      const storedToken = await db.refreshToken.findUnique({
        where: { token_hash: tokenHash },
      });

      if (storedToken && !storedToken.revoked_at) {
        await db.refreshToken.update({
          where: { id: storedToken.id },
          data: { revoked_at: new Date() },
        });
      }
    }

    // ── Log de auditoria ──
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    logAudit({
      firm_id: userFirmId ?? undefined,
      user_id: userId ?? undefined,
      action: 'LOGOUT',
      entity_type: 'User',
      entity_id: userId ?? undefined,
      ip_address: clientIp,
      user_agent: userAgent,
    });

    // ── Resposta de sucesso ──
    return NextResponse.json({
      success: true,
      data: {
        message: 'Sessão terminada com sucesso.',
      },
    });
  } catch (error) {
    // Log do erro para depuração
    console.error('[LOGOUT] Erro interno:', error);

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
