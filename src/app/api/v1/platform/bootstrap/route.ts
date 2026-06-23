// ═══════════════════════════════════════════════════════════════
// LEXDOC — Bootstrap Super Admin
// POST /api/v1/platform/bootstrap
// Promove o primeiro ADMIN da plataforma a SUPER_ADMIN.
// Só funciona se NENHUM SUPER_ADMIN existir ainda.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload, req } = auth;

  // Apenas ADMIN pode ser promovido
  if (payload.role !== 'ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Apenas administradores podem ser promovidos a Super Administrador.',
        },
      },
      { status: 403 },
    );
  }

  try {
    // Verificar se já existe um SUPER_ADMIN
    const existingSuper = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, full_name: true },
    });

    if (existingSuper) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Já existe um Super Administrador na plataforma.',
            data: {
              super_admin: {
                id: existingSuper.id,
                email: existingSuper.email,
                full_name: existingSuper.full_name,
              },
            },
          },
        },
        { status: 409 },
      );
    }

    // Promover o utilizador actual
    const promoted = await db.user.update({
      where: { id: payload.sub },
      data: { role: 'SUPER_ADMIN' },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        firm_id: true,
      },
    });

    // Log de auditoria (no firm do utilizador)
    logAudit({
      firm_id: promoted.firm_id,
      user_id: promoted.id,
      action: 'SUPER_ADMIN_PROMOTED',
      entity_type: 'User',
      entity_id: promoted.id,
      new_values: {
        email: promoted.email,
        role: 'SUPER_ADMIN',
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Promovido a Super Administrador com sucesso.',
        user: promoted,
      },
    });
  } catch (error) {
    console.error('[BOOTSTRAP] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}