// ═══════════════════════════════════════════════════════════════
// LEXDOC — Endpoint de Registo de Utilizador
// POST /api/v1/auth/register
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { VALID_ROLES } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Validações
// ─────────────────────────────────────────
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    PASSWORD_REGEX.test(password)
  );
}

function isValidFullName(name: string): boolean {
  return name.trim().length >= 2 && name.length <= 255;
}

function isValidFirmName(name: string): boolean {
  return name.trim().length >= 2 && name.length <= 255;
}

/** Gerar slug a partir do nome do escritório */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9à-ÿ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Gerar slug único (adiciona sufixo numérico se necessário) */
async function generateUniqueSlug(name: string): Promise<string> {
  let slug = generateSlug(name);
  let suffix = 0;
  let exists = await db.firm.findUnique({ where: { slug } });
  while (exists) {
    suffix++;
    slug = `${generateSlug(name)}-${suffix}`;
    exists = await db.firm.findUnique({ where: { slug } });
  }
  return slug;
}

// ─────────────────────────────────────────
// POST Handler
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting: 3 registos por IP por hora ──
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateCheck = checkRateLimit(
      `register:${clientIp}`,
      3,
      60 * 60_000, // 1 hora
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Demasiadas tentativas de registo. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // Parsear corpo do pedido
    const body = await request.json();
    const { full_name, email, password, firm_name, role } = body as {
      full_name?: string;
      email?: string;
      password?: string;
      firm_name?: string;
      role?: string;
    };

    // ── Validação dos campos obrigatórios ──
    const errors: string[] = [];

    if (!full_name || !isValidFullName(full_name)) {
      errors.push('Nome completo deve ter entre 2 e 255 caracteres.');
    }

    if (!email || typeof email !== 'string') {
      errors.push('Email é obrigatório.');
    } else {
      const normalizedEmail = email.toLowerCase().trim();
      if (!isValidEmail(normalizedEmail)) {
        errors.push('Formato de email inválido.');
      }
      if (normalizedEmail.length > 255) {
        errors.push('Email não pode exceder 255 caracteres.');
      }
    }

    if (!password || !isValidPassword(password)) {
      errors.push(
        'Password deve ter entre 8 e 128 caracteres, incluindo maiúscula, minúscula, número e carácter especial (@$!%*?&).'
      );
    }

    if (!firm_name || !isValidFirmName(firm_name)) {
      errors.push('Nome do escritório deve ter entre 2 e 255 caracteres.');
    }

    // Role é sempre ignorado no registo público — primeiro utilizador é ADMIN por defeito
    // Role fornecido pelo cliente nunca é aceite por segurança

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: errors,
          },
        },
        { status: 400 }
      );
    }

    // ── Normalização ──
    const normalizedEmail = email.toLowerCase().trim();
    const userRole = 'ADMIN'; // Primeiro utilizador de um novo escritório é sempre ADMIN
    const slug = await generateUniqueSlug(firm_name);

    // ── Verificar se email já existe ──
    // Mensagem genérica — não vazar que o email existe
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Dados inválidos. Verifique as informações fornecidas.',
          },
        },
        { status: 409 }
      );
    }

    // ── Hash da password ──
    const passwordHash = await hashPassword(password);

    // ── Criar escritório (Firm) — UUID gerado client-side ──
    const firmId = randomUUID();
    const firm = await db.firm.create({
      data: {
        id: firmId,
        name: firm_name.trim(),
        slug,
      },
    });

    // ── Criar utilizador vinculado ao escritório — UUID gerado client-side ──
    const userId = randomUUID();
    const user = await db.user.create({
      data: {
        id: userId,
        firm_id: firm.id,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: full_name.trim(),
        role: userRole,
      },
    });

    // ── Gerar tokens ──
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      firm_id: user.firm_id,
    });

    const refreshToken = generateRefreshToken({
      sub: user.id,
    });

    // ── Hash e guardar refresh token ──
    const refreshTokenHash = hashToken(refreshToken);

    // Calcular data de expiração do refresh token (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.refreshToken.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: expiresAt,
        ip_address: request.headers.get('x-forwarded-for') ?? undefined,
        device_info: request.headers.get('user-agent') ?? undefined,
      },
    });

    // ── Log de auditoria ──
    logAudit({
      firm_id: firm.id,
      user_id: user.id,
      action: 'USER_CREATED',
      entity_type: 'User',
      entity_id: user.id,
      new_values: {
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        firm_name: firm.name,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    // ── Resposta de sucesso ──
    return NextResponse.json(
      {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firm_id: user.firm_id,
            full_name: user.full_name,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Log detalhado do erro para depuração (nunca exibir detalhes ao utilizador)
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack?.split('\n').slice(0, 5) }
      : { message: String(error) };
    console.error('[REGISTER] Erro interno:', JSON.stringify(errorInfo, null, 2));

    // Detectar erros específicos para logging
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('DIRECT_URL') || msg.includes('Environment variable')) {
        console.error('[REGISTER] ERRO: Variável de ambiente DIRECT_URL em falta. Verifique as env vars no painel.');
      }
      if (msg.includes('prepared statement') || msg.includes('42P05')) {
        console.error('[REGISTER] ERRO: PgBouncer - prepared statement conflict. Use Session Mode ou adicione ?pgbouncer=true à DATABASE_URL.');
      }
      if (msg.includes('relation') && msg.includes('does not exist')) {
        console.error('[REGISTER] ERRO: Tabela não existe na base de dados. Execute prisma db push com a DATABASE_URL do Supabase.');
      }
      if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
        console.error('[REGISTER] ERRO: Não foi possível ligar à base de dados. Verifique a DATABASE_URL.');
      }
    }

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
