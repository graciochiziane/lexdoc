// ═══════════════════════════════════════════════════════════════
// LEXDOC — Clientes: Obter e Actualizar por ID
// GET   /api/v1/clients/:id — Obter cliente por ID
// PATCH /api/v1/clients/:id — Actualizar cliente (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Obter cliente por ID
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  try {
    const { id } = await params;

    // Buscar cliente — filtrar SEMPRE por firm_id
    const client = await db.client.findFirst({
      where: { id, firm_id: payload.firm_id },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        address: true,
        client_type: true,
        is_active: true,
        notes: true,
        created_at: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    console.error('[CLIENTS GET] Erro interno:', error);
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

// ─────────────────────────────────────────
// PATCH — Actualizar cliente
// ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem actualizar clientes
  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Sem permissão para realizar esta operação.',
        },
      },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Verificar se o cliente existe e pertence ao escritório
    const existingClient = await db.client.findFirst({
      where: { id, firm_id: payload.firm_id },
    });

    if (!existingClient) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' },
        },
        { status: 404 }
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { full_name, email, phone, bi_number, nif, address, client_type, notes, is_active } = body as {
      full_name?: string;
      email?: string;
      phone?: string;
      bi_number?: string;
      nif?: string;
      address?: string;
      client_type?: string;
      notes?: string;
      is_active?: boolean;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
      errors.push('Nome completo deve ter no mínimo 2 caracteres.');
    }

    if (email !== undefined && email !== null && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Formato de email inválido.');
      }
    }

    const validTypes = ['INDIVIDUAL', 'EMPRESA'];
    if (client_type !== undefined && !validTypes.includes(client_type.toUpperCase())) {
      errors.push('Tipo de cliente inválido. Valores permitidos: INDIVIDUAL, EMPRESA.');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: errors },
        },
        { status: 400 }
      );
    }

    // ── Construir dados de actualização ──
    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (full_name !== undefined) {
      oldValues.full_name = existingClient.full_name;
      updateData.full_name = full_name.trim();
      newValues.full_name = updateData.full_name;
    }

    if (email !== undefined) {
      oldValues.email = existingClient.email;
      updateData.email = email?.trim() || null;
      newValues.email = updateData.email;
    }

    if (phone !== undefined) {
      oldValues.phone = existingClient.phone;
      updateData.phone = phone?.trim() || null;
      newValues.phone = updateData.phone;
    }

    if (bi_number !== undefined) {
      updateData.bi_number = bi_number?.trim() || null;
      // Não incluir PII no log
    }

    if (nif !== undefined) {
      updateData.nif = nif?.trim() || null;
      // Não incluir PII no log
    }

    if (address !== undefined) {
      oldValues.address = existingClient.address;
      updateData.address = address?.trim() || null;
      newValues.address = updateData.address;
    }

    if (client_type !== undefined) {
      oldValues.client_type = existingClient.client_type;
      updateData.client_type = client_type.toUpperCase();
      newValues.client_type = updateData.client_type;
    }

    if (notes !== undefined) {
      oldValues.notes = existingClient.notes;
      updateData.notes = notes?.trim() || null;
      newValues.notes = updateData.notes;
    }

    if (is_active !== undefined) {
      oldValues.is_active = existingClient.is_active;
      updateData.is_active = is_active;
      newValues.is_active = is_active;
    }

    // Nenhum campo para actualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Nenhum campo fornecido para actualização.',
          },
        },
        { status: 400 }
      );
    }

    // ── Actualizar cliente ──
    const updatedClient = await db.client.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        address: true,
        client_type: true,
        is_active: true,
        notes: true,
        created_at: true,
      },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CLIENT_UPDATED',
      entity_type: 'Client',
      entity_id: id,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: updatedClient });
  } catch (error) {
    console.error('[CLIENTS UPDATE] Erro interno:', error);
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
