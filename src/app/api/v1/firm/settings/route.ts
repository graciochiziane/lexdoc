// ═══════════════════════════════════════════════════════════════
// LEXDOC — Configurações do Escritório
// GET /api/v1/firm/settings — Informações do escritório
// PATCH /api/v1/firm/settings — Actualizar configurações (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { hasRole } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Informações do escritório
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  try {
    const firm = await db.firm.findUnique({
      where: { id: payload.firm_id },
      select: {
        id: true,
        name: true,
        slug: true,
        nif: true,
        oam_number: true,
        is_active: true,
        plan: true,
        created_at: true,
        _count: {
          select: { users: true },
        },
      },
    });

    if (!firm) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: firm.id,
        name: firm.name,
        slug: firm.slug,
        nif: firm.nif,
        oam_number: firm.oam_number,
        is_active: firm.is_active,
        plan: firm.plan,
        created_at: firm.created_at,
        member_count: firm._count.users,
      },
    });
  } catch (error) {
    console.error('[FIRM_SETTINGS] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// PATCH: Actualizar configurações (ADMIN)
// ─────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload, req } = auth;

  // Apenas ADMIN ou SUPER_ADMIN pode alterar configurações
  if (!hasRole(payload.role, ['ADMIN'])) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso negado. Apenas administradores podem alterar configurações.' },
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { name, nif, oam_number } = body as {
      name?: string;
      nif?: string;
      oam_number?: string;
    };

    const errors: string[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.length > 255) {
        errors.push('Nome do escritório deve ter entre 2 e 255 caracteres.');
      }
    }

    if (nif !== undefined) {
      if (typeof nif !== 'string' || nif.trim().length === 0) {
        errors.push('NIF inválido.');
      }
    }

    if (oam_number !== undefined) {
      if (typeof oam_number !== 'string' || oam_number.trim().length === 0) {
        errors.push('Número OAM inválido.');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: errors },
        },
        { status: 400 },
      );
    }

    // Buscar valores antigos para auditoria
    const oldFirm = await db.firm.findUnique({
      where: { id: payload.firm_id },
      select: { name: true, nif: true, oam_number: true },
    });

    if (!oldFirm) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' },
        },
        { status: 404 },
      );
    }

    // Construir dados de actualização
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (nif !== undefined) updateData.nif = nif.trim();
    if (oam_number !== undefined) updateData.oam_number = oam_number.trim();

    // Actualizar
    const firm = await db.firm.update({
      where: { id: payload.firm_id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        nif: true,
        oam_number: true,
        is_active: true,
        plan: true,
        created_at: true,
      },
    });

    // Log de auditoria
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'FIRM_SETTINGS_UPDATED',
      entity_type: 'Firm',
      entity_id: payload.firm_id,
      old_values: {
        name: oldFirm.name,
        nif: oldFirm.nif,
        oam_number: oldFirm.oam_number,
      },
      new_values: updateData,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: firm,
    });
  } catch (error) {
    console.error('[FIRM_SETTINGS] Erro PATCH:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
