// ═══════════════════════════════════════════════════════════════
// LEXDOC — Clientes: Listar e Criar
// GET  /api/v1/clients — Listar clientes do escritório
// POST /api/v1/clients — Criar novo cliente
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Listar clientes
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);

    // Filtros opcionais
    const search = searchParams.get('search')?.trim() || '';
    const clientType = searchParams.get('client_type')?.toUpperCase();

    // Validar tipo de cliente
    const validTypes = ['INDIVIDUAL', 'EMPRESA'];
    if (clientType && !validTypes.includes(clientType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tipo de cliente inválido. Valores permitidos: INDIVIDUAL, EMPRESA.',
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (search) {
      (where as Record<string, unknown[]>)['OR'] = [
        { full_name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (clientType) {
      where.client_type = clientType;
    }

    // Contar total e buscar registos
    const [total, clients] = await Promise.all([
      db.client.count({ where }),
      db.client.findMany({
        where,
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
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: clients,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[CLIENTS LIST] Erro interno:', error);
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
// POST — Criar cliente
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  try {
    const body = await request.json();
    const { full_name, email, phone, bi_number, nif, address, client_type, notes } = body as {
      full_name?: string;
      email?: string;
      phone?: string;
      bi_number?: string;
      nif?: string;
      address?: string;
      client_type?: string;
      notes?: string;
    };

    // ── Validações ──
    const errors: string[] = [];

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      errors.push('Nome completo é obrigatório (mínimo 2 caracteres).');
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

    const normalizedClientType = client_type ? client_type.toUpperCase() : 'INDIVIDUAL';

    // ── Criar cliente ──
    const client = await db.client.create({
      data: {
        firm_id: payload.firm_id,
        full_name: full_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        bi_number: bi_number?.trim() || null,
        nif: nif?.trim() || null,
        address: address?.trim() || null,
        client_type: normalizedClientType,
        notes: notes?.trim() || null,
      },
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

    // ── Log de auditoria (sem PII) ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CLIENT_CREATED',
      entity_type: 'Client',
      entity_id: client.id,
      new_values: {
        full_name: client.full_name,
        client_type: client.client_type,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('[CLIENTS CREATE] Erro interno:', error);
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
