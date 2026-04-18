// ═══════════════════════════════════════════════════════════════
// LEXDOC — API de Perfil do Utilizador
// GET /api/v1/profile — obter perfil
// PATCH /api/v1/profile — actualizar dados
// PATCH /api/v1/profile/password — alterar palavra-passe
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { verifyPassword, hashPassword } from '@/lib/auth';

process.env.TZ = 'Africa/Maputo';

// ═══════════════════════════════════════════════════════════════
// GET /api/v1/profile — Perfil completo com dados do escritório
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  try {
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        is_active: true,
        email_verified: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        firm: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        member_since: user.created_at,
      },
    });
  } catch (error) {
    console.error('[PROFILE/GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/v1/profile — Actualizar nome e telefone
// ═══════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const firmId = payload.firm_id;
  const userId = payload.sub;

  try {
    const body = await request.json();
    const { full_name, phone } = body as { full_name?: string; phone?: string };

    // Validações
    if (!full_name && !phone) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Forneça pelo menos um campo para actualizar.' } },
        { status: 400 },
      );
    }

    if (full_name && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'O nome deve ter pelo menos 2 caracteres.' } },
        { status: 400 },
      );
    }

    if (phone && typeof phone === 'string' && phone.trim() !== '' && !/^[\d\s+()-]{7,20}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Formato de telefone inválido.' } },
        { status: 400 },
      );
    }

    // Buscar valores antigos para auditoria
    const existingUser = await db.user.findUnique({
      where: { id: userId },
      select: { full_name: true, phone: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Utilizador não encontrado.' } },
        { status: 404 },
      );
    }

    const oldValues: Record<string, string> = {};
    const newValues: Record<string, string> = {};

    if (full_name && full_name !== existingUser.full_name) {
      oldValues.full_name = existingUser.full_name;
      newValues.full_name = full_name.trim();
    }

    if (phone !== undefined && phone !== existingUser.phone) {
      oldValues.phone = existingUser.phone ?? '';
      newValues.phone = phone.trim() || null;
    }

    // Verificar se há alterações reais
    if (Object.keys(newValues).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CHANGES', message: 'Nenhuma alteração detectada.' } },
        { status: 400 },
      );
    }

    // Actualizar
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(newValues.full_name ? { full_name: newValues.full_name } : {}),
        ...(newValues.phone !== undefined ? { phone: newValues.phone } : {}),
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        is_active: true,
        email_verified: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Auditoria
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'UPDATE',
      entity_type: 'Profile',
      entity_id: userId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[PROFILE/PATCH] Erro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
      { status: 500 },
    );
  }
}
