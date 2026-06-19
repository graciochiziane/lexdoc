// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Renovação de Token (Refresh)
// POST /api/v1/auth/refresh
// Rotação de tokens: o token antigo é revogado e um novo par é gerado
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Parsear corpo do pedido ──
    const body = await request.json();
    const { refresh_token } = body as { refresh_token?: string };

    if (!refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Verificar integridade do JWT ──
    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Hash do token recebido e buscar na base de dados ──
    const tokenHash = hashToken(refresh_token);

    const storedToken = await db.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Verificar se não foi revogado ──
    if (storedToken.revoked_at) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Verificar se não expirou ──
    if (new Date(storedToken.expires_at) <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Verificar se utilizador ainda existe e está activo ──
    if (!storedToken.user || !storedToken.user.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de sessão inválido ou expirado.',
          },
        },
        { status: 401 }
      );
    }

    // ── Revogar token antigo ──
    await db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    // ── Gerar novo par de tokens ──
    const newAccessToken = generateAccessToken({
      sub: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
      firm_id: storedToken.user.firm_id,
    });

    const newRefreshToken = generateRefreshToken({
      sub: storedToken.user.id,
    });

    // ── Hash e guardar novo refresh token ──
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // Calcular data de expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    // Usar executeRaw para evitar Prisma relation populate bloqueado por RLS
    const refreshTokenId = randomUUID();
    await db.$executeRaw`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip_address, device_info, created_at)
      VALUES (${refreshTokenId}::uuid, ${storedToken.user.id}::uuid, ${newRefreshTokenHash}, ${expiresAt}::timestamptz,
              ${clientIp ?? null}, ${userAgent ?? null}, now()::timestamptz)
    `;

    // ── Log de auditoria ──
    logAudit({
      firm_id: storedToken.user.firm_id,
      user_id: storedToken.user.id,
      action: 'REFRESH_TOKEN_USED',
      entity_type: 'RefreshToken',
      entity_id: storedToken.id,
      ip_address: clientIp,
      user_agent: userAgent,
    });

    // ── Resposta com novos tokens + user ──
    return NextResponse.json({
      success: true,
      data: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: {
          id: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
          firm_id: storedToken.user.firm_id,
          full_name: storedToken.user.full_name,
        },
      },
    });
  } catch (error) {
    // Log do erro para depuração
    console.error('[REFRESH] Erro interno:', error);

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
