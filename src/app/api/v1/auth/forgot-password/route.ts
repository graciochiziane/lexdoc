// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Recuperação de Palavra-passe
// POST /api/v1/auth/forgot-password
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createResetToken,
} from '@/lib/reset-token-store';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const MAX_FORGOT_ATTEMPTS = 3;
const FORGOT_WINDOW_MS = 60 * 60_000; // 1 hora
const TOKEN_EXPIRY_MS = 60 * 60_000; // 1 hora

// ═══════════════════════════════════════════════════════════════
// POST /api/v1/auth/forgot-password
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting por IP ──
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateCheck = checkRateLimit(
      `forgot-password:${clientIp}`,
      MAX_FORGOT_ATTEMPTS,
      FORGOT_WINDOW_MS,
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Demasiadas tentativas. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // ── Parsear corpo ──
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email obrigatório.',
          },
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Buscar utilizador ──
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Resposta genérica (não revelar se o email existe)
    let demoResetLink: string | null = null;
    if (user) {
      // Gerar token de reset
      const rawToken = createResetToken(
        user.id,
        user.firm_id,
        TOKEN_EXPIRY_MS,
      );

      // Log de auditoria
      logAudit({
        firm_id: user.firm_id,
        user_id: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity_type: 'User',
        entity_id: user.id,
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') ?? undefined,
      });

      // Log do link para demo (sem serviço de email)
      const resetLink = `/reset-password?token=${rawToken}`;
      demoResetLink = resetLink;
      console.log(`[PASSWORD_RESET] Reset link for ${normalizedEmail}: ${resetLink}`);
    }

    // Resposta genérica de sucesso
    return NextResponse.json({
      success: true,
      data: {
        message: 'Se existir uma conta com este email, receberá instruções para redefinir a palavra-passe.',
        // Incluir link para demo purposes
        ...(demoResetLink ? { reset_link: demoResetLink } : {}),
      },
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor. Tente novamente mais tarde.',
        },
      },
      { status: 500 },
    );
  }
}
