// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Redefinição de Palavra-passe
// POST /api/v1/auth/reset-password
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Armazenamento em memória de tokens de reset
// (compartilhado com forgot-password via import)
// Como é o mesmo processo, precisamos re-exportar o store
// Alternativa: usar um módulo compartilhado
// ═════════──────────────────────────────────────────────────────

// ─────────────────────────────────────────
// Requisitos de força da palavra-passe
// ─────────────────────────────────────────
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Palavra-passe deve ter pelo menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Deve conter uma letra maiúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Deve conter uma letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Deve conter um número.';
  }
  if (!/[@$!%*?&\-_]/.test(password)) {
    return 'Deve conter um carácter especial (@$!%*?&).';
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/v1/auth/reset-password
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    // ── Parsear corpo ──
    const body = await request.json();
    const { token, new_password, confirm_password } = body as {
      token?: string;
      new_password?: string;
      confirm_password?: string;
    };

    // Validação básica
    if (!token || !new_password || !confirm_password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Token, nova palavra-passe e confirmação são obrigatórios.',
          },
        },
        { status: 400 },
      );
    }

    if (new_password !== confirm_password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'As palavras-passe não coincidem.',
          },
        },
        { status: 400 },
      );
    }

    // Validar força da palavra-passe
    const strengthError = validatePasswordStrength(new_password);
    if (strengthError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: strengthError,
          },
        },
        { status: 400 },
      );
    }

    // ── Buscar utilizador e token no store ──
    // O token armazenado é por userId, precisamos encontrar o userId pelo token
    // Como usamos hash, precisamos buscar de forma diferente
    // Solução: importar o store diretamente ou re-implementar a busca

    // Nota: O token raw vem do URL params. Precisamos comparar contra o hash.
    // Como não temos uma referência direta ao Map, vamos buscar o user pelo
    // fato de que o reset-password e forgot-password rodam no mesmo processo.
    // Vamos usar uma abordagem diferente: importar o store de um módulo compartilhado.

    // Por enquanto, vamos buscar todos os users e verificar... não é eficiente.
    // Melhor: vamos usar o store diretamente via re-import.

    // Workaround: usar db para verificar se o token pertence a algum utilizador
    // Na prática, o token é armazenado em memória. Precisamos acessá-lo.
    // Vamos criar um módulo compartilhado.

    // Por simplicidade, vamos usar uma importação directa do módulo forgot-password
    // não funciona em Next.js. Então vamos mover o store para um lib separado.

    // TODO: Isso é um workaround — vamos usar o store global
    // Vamos importar dinamicamente
    const { getResetTokenEntry, deleteResetToken } = await import(
      '@/lib/reset-token-store'
    );

    // Buscar entrada por token (comparação lenta mas segura)
    const entry = getResetTokenEntry(token);
    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token inválido ou expirado.',
          },
        },
        { status: 400 },
      );
    }

    // Verificar expiração
    if (Date.now() > entry.expiresAt) {
      deleteResetToken(entry.userId);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token expirado. Solicite uma nova redefinição.',
          },
        },
        { status: 400 },
      );
    }

    // ── Buscar utilizador ──
    const user = await db.user.findUnique({
      where: { id: entry.userId },
    });

    if (!user || !user.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token inválido ou conta inactiva.',
          },
        },
        { status: 400 },
      );
    }

    // ── Verificar que a nova password é diferente da actual ──
    const isSamePassword = await verifyPassword(new_password, user.password_hash);
    if (isSamePassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A nova palavra-passe deve ser diferente da actual.',
          },
        },
        { status: 400 },
      );
    }

    // ── Actualizar password ──
    const newPasswordHash = await hashPassword(new_password);
    await db.user.update({
      where: { id: user.id },
      data: {
        password_hash: newPasswordHash,
        failed_login_count: 0,
        locked_until: null,
      },
    });

    // Invalidar token
    deleteResetToken(entry.userId);

    // Log de auditoria
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    logAudit({
      firm_id: user.firm_id,
      user_id: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity_type: 'User',
      entity_id: user.id,
      ip_address: clientIp,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Palavra-passe redefinida com sucesso. Pode agora iniciar sessão.',
      },
    });
  } catch (error) {
    console.error('[RESET_PASSWORD] Erro:', error);
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
