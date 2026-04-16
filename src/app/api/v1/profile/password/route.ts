// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Alteração de Palavra-passe
// PATCH /api/v1/profile/password
// Requer: current_password + new_password (min 8 chars, 1 upper, 1 number, 1 special)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { verifyPassword, hashPassword } from '@/lib/auth';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Validação da nova palavra-passe
// ─────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'A palavra-passe deve ter pelo menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos uma letra maiúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos uma letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos um número.';
  }
  if (!/[@$!%*?&._~#\-()]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos um carácter especial.';
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/v1/profile/password
// ═══════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const userId = payload.sub;

  try {
    const body = await request.json();
    const { current_password, new_password, confirm_password } = body as {
      current_password?: string;
      new_password?: string;
      confirm_password?: string;
    };

    // ── Validações de campos obrigatórios ──
    if (!current_password || !new_password || !confirm_password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Todos os campos são obrigatórios.' } },
        { status: 400 },
      );
    }

    // ── Confirmar correspondência ──
    if (new_password !== confirm_password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A nova palavra-passe e a confirmação não coincidem.' } },
        { status: 400 },
      );
    }

    // ── Validar força da nova palavra-passe ──
    const validationError = validatePassword(new_password);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationError } },
        { status: 400 },
      );
    }

    // ── Buscar utilizador com hash actual ──
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, password_hash: true, is_active: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' } },
        { status: 404 },
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Conta desactivada.' } },
        { status: 403 },
      );
    }

    // ── Verificar palavra-passe actual ──
    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'A palavra-passe actual está incorrecta.' } },
        { status: 400 },
      );
    }

    // ── Gerar novo hash e actualizar ──
    const newHash = await hashPassword(new_password);
    await db.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    // ── Auditoria (sem expor dados sensíveis) ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: userId,
      action: 'PASSWORD_CHANGE',
      entity_type: 'Profile',
      entity_id: userId,
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Palavra-passe alterada com sucesso.' },
    });
  } catch (error) {
    console.error('[PROFILE/PASSWORD] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
