// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Login com Bloqueio de Conta
// POST /api/v1/auth/login
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Constantes de segurança
// ─────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5; // tentativas por 60 segundos
const LOGIN_WINDOW_MS = 60_000; // 60 segundos
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// ─────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting por IP ──
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateCheck = checkRateLimit(clientIp, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Demasiadas tentativas. Aguarde antes de tentar novamente.',
          },
        },
        { status: 429 }
      );
    }

    // ── Parsear corpo do pedido ──
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    // Validação básica
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Credenciais inválidas.',
          },
        },
        { status: 401 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Buscar utilizador por email ──
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { firm: true },
    });

    // Utilizador não encontrado — erro genérico (não revelar que o email não existe)
    if (!user) {
      logAudit({
        action: 'LOGIN_FAILED',
        entity_type: 'User',
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') ?? undefined,
        metadata: { reason: 'user_not_found', email: normalizedEmail },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciais inválidas.',
          },
        },
        { status: 401 }
      );
    }

    // ── Verificar se conta está bloqueada ──
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      logAudit({
        firm_id: user.firm_id,
        user_id: user.id,
        action: 'LOGIN_BLOCKED',
        entity_type: 'User',
        entity_id: user.id,
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') ?? undefined,
        metadata: { locked_until: user.locked_until },
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message:
              'Conta temporariamente bloqueada por segurança. Tente novamente em 15 minutos.',
          },
        },
        { status: 403 }
      );
    }

    // ── Verificar password ──
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      // ── Incrementar contagem de falhas ──
      const newFailedCount = user.failed_login_count + 1;
      const shouldLock = newFailedCount >= 5;

      const lockedUntil = shouldLock
        ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS)
        : null;

      await db.user.update({
        where: { id: user.id },
        data: {
          failed_login_count: newFailedCount,
          locked_until: lockedUntil,
        },
      });

      // Log de auditoria
      if (shouldLock) {
        logAudit({
          firm_id: user.firm_id,
          user_id: user.id,
          action: 'ACCOUNT_LOCKED',
          entity_type: 'User',
          entity_id: user.id,
          old_values: { failed_login_count: user.failed_login_count },
          new_values: {
            failed_login_count: newFailedCount,
            locked_until: lockedUntil?.toISOString(),
          },
          ip_address: clientIp,
          user_agent: request.headers.get('user-agent') ?? undefined,
        });
      }

      logAudit({
        firm_id: user.firm_id,
        user_id: user.id,
        action: 'LOGIN_FAILED',
        entity_type: 'User',
        entity_id: user.id,
        new_values: {
          failed_login_count: newFailedCount,
          locked: shouldLock,
        },
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') ?? undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciais inválidas.',
          },
        },
        { status: 401 }
      );
    }

    // ── Login bem-sucedido ──

    // Reset contagem de falhas e actualizar last_login_at
    await db.user.update({
      where: { id: user.id },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    // Gerar tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      firm_id: user.firm_id,
    });

    const refreshToken = generateRefreshToken({
      sub: user.id,
    });

    // Hash e guardar refresh token
    const refreshTokenHash = hashToken(refreshToken);

    // Calcular data de expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Guardar refresh token com Prisma (seguro, sem SQL injection, funciona com PgBouncer)
    try {
      await db.refreshToken.create({
        data: {
          id: randomUUID(),
          user_id: user.id,
          token_hash: refreshTokenHash,
          ip_address: clientIp,
          user_agent: request.headers.get('user-agent') ?? undefined,
          expires_at: expiresAt,
        },
      });
    } catch (rtError) {
      console.error('[LOGIN] Aviso: refresh_token não guardado (non-critical):', rtError);
    }

    // Log de auditoria
    logAudit({
      firm_id: user.firm_id,
      user_id: user.id,
      action: 'LOGIN_SUCCESS',
      entity_type: 'User',
      entity_id: user.id,
      ip_address: clientIp,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    // Resposta de sucesso
    return NextResponse.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firm_id: user.firm_id,
          full_name: user.full_name,
        },
      },
    });
  } catch (error) {
    // Log do erro para depuração
    console.error('[LOGIN] Erro interno:', error);

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
