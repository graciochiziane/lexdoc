// ═══════════════════════════════════════════════════════════════
// LEXDOC — Sistema de Convites
// POST /api/v1/invitations — Criar convite (ADMIN)
// GET /api/v1/invitations — Listar convites pendentes (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { VALID_ROLES } from '@/lib/rbac';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Validações
// ─────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────
// POST: Criar convite (ADMIN)
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload, req } = auth;

  // Apenas ADMIN pode criar convites
  if (payload.role !== 'ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso negado. Apenas administradores podem criar convites.' },
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email, role, full_name } = body as {
      email?: string;
      role?: string;
      full_name?: string;
    };

    const errors: string[] = [];

    // Validar email
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      errors.push('Email inválido.');
    }

    // Validar role
    if (!role || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      errors.push('Papel inválido. Valores permitidos: ADMIN, ADVOGADO, SECRETARIO, CLIENT.');
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

    const normalizedEmail = email.trim().toLowerCase();

    // Verificar se email já é utilizador do escritório
    const existingUser = await db.user.findFirst({
      where: {
        email: normalizedEmail,
        firm_id: payload.firm_id,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONFLICT', message: 'Este email já pertence a um utilizador do escritório.' },
        },
        { status: 409 },
      );
    }

    // Verificar se já existe convite pendente
    const existingInvitation = await db.invitation.findFirst({
      where: {
        email: normalizedEmail,
        firm_id: payload.firm_id,
        accepted_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONFLICT', message: 'Já existe um convite pendente para este email.' },
        },
        { status: 409 },
      );
    }

    // Gerar token único
    const token = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Expira em 7 dias
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Criar convite
    const invitation = await db.invitation.create({
      data: {
        firm_id: payload.firm_id,
        email: normalizedEmail,
        role,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Log de auditoria
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'INVITATION_CREATED',
      entity_type: 'Invitation',
      entity_id: invitation.id,
      new_values: {
        email: normalizedEmail,
        role,
        full_name: full_name ?? null,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    // Retornar dados do convite incluindo o token em texto limpo (para gerar link)
    return NextResponse.json(
      {
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[INVITATIONS] Erro POST:', error);
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
// GET: Listar convites (ADMIN)
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload } = auth;

  // Apenas ADMIN pode ver convites
  if (payload.role !== 'ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso negado.' },
      },
      { status: 403 },
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = parsePagination(searchParams);
    const search = searchParams.get('search') ?? '';

    // Construir filtros
    const where: Record<string, unknown> = {
      firm_id: payload.firm_id,
    };

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    // Buscar convites
    const [invitations, total] = await Promise.all([
      db.invitation.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          created_at: true,
          expires_at: true,
          accepted_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip: calcSkip(page, limit),
        take: limit,
      }),
      db.invitation.count({ where }),
    ]);

    // Adicionar campo status calculado
    const invitationsWithStatus = invitations.map((inv) => ({
      ...inv,
      status: inv.accepted_at
        ? 'ACCEPTED'
        : new Date(inv.expires_at) < new Date()
          ? 'EXPIRED'
          : 'PENDING',
    }));

    return NextResponse.json({
      success: true,
      data: invitationsWithStatus,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[INVITATIONS] Erro GET:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
