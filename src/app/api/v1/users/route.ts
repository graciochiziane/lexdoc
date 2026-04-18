// ═══════════════════════════════════════════════════════════════
// LEXDOC — Utilizadores: Listar e Criar
// GET  /api/v1/users — Listar utilizadores do escritório
// POST /api/v1/users — Criar novo utilizador (ADMIN/ADVOGADO)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole, VALID_ROLES } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET — Listar utilizadores
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
    const roleFilter = searchParams.get('role')?.toUpperCase();

    // Validar role se fornecido
    if (roleFilter && !VALID_ROLES.includes(roleFilter as (typeof VALID_ROLES)[number])) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Papel inválido.',
          },
        },
        { status: 400 }
      );
    }

    // Construir cláusula WHERE — filtrar SEMPRE por firm_id
    const where: Record<string, unknown> = { firm_id: payload.firm_id };

    if (search) {
      (where as Record<string, unknown[]>)['OR'] = [
        { email: { contains: search } },
        { full_name: { contains: search } },
      ];
    }

    if (roleFilter) {
      where.role = roleFilter;
    }

    // Contar total e buscar registos
    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          full_name: true,
          role: true,
          phone: true,
          is_active: true,
          email_verified: true,
          created_at: true,
          last_login_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[USERS LIST] Erro interno:', error);
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
// POST — Criar utilizador
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Autenticação
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;

  const { payload, req } = authResult;

  // Apenas ADMIN ou ADVOGADO podem criar utilizadores
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
    const body = await request.json();
    const { email, full_name, password, role, phone } = body as {
      email?: string;
      full_name?: string;
      password?: string;
      role?: string;
      phone?: string;
    };

    // ── Validação dos campos ──
    const errors: string[] = [];

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      errors.push('Nome completo é obrigatório (mínimo 2 caracteres).');
    }

    if (!email || typeof email !== 'string') {
      errors.push('Email é obrigatório.');
    } else {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        errors.push('Formato de email inválido.');
      }
      if (normalizedEmail.length > 255) {
        errors.push('Email não pode exceder 255 caracteres.');
      }
    }

    if (!password || typeof password !== 'string') {
      errors.push('Password é obrigatória.');
    } else {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
      if (password.length < 8 || password.length > 128 || !passwordRegex.test(password)) {
        errors.push(
          'Password deve ter entre 8 e 128 caracteres, incluindo maiúscula, minúscula, número e carácter especial.'
        );
      }
    }

    if (role !== undefined && !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      errors.push('Papel inválido. Valores permitidos: ADMIN, ADVOGADO, SECRETARIO, CLIENT.');
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

    const normalizedEmail = email.toLowerCase().trim();
    const userRole = role || 'CLIENT';

    // ── Verificar se email já existe (mesmo escritório) ──
    const existingUser = await db.user.findFirst({
      where: {
        firm_id: payload.firm_id,
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Já existe um utilizador com este email no escritório.',
          },
        },
        { status: 409 }
      );
    }

    // ── Hash da password ──
    const passwordHash = await hashPassword(password);

    // ── Criar utilizador ──
    const user = await db.user.create({
      data: {
        firm_id: payload.firm_id,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: full_name.trim(),
        role: userRole,
        phone: phone?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone: true,
        is_active: true,
        email_verified: true,
        created_at: true,
        last_login_at: true,
      },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'USER_CREATED',
      entity_type: 'User',
      entity_id: user.id,
      new_values: {
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error('[USERS CREATE] Erro interno:', error);
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
