// ═══════════════════════════════════════════════════════════════
// LEXDOC — Aceitar Convite (público)
// POST /api/v1/invitations/[token]/accept — Aceitar convite e criar conta
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import crypto, { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Validações
// ─────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    PASSWORD_REGEX.test(password)
  );
}

// ─────────────────────────────────────────
// POST: Aceitar convite
// ─────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // Validar o token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await db.invitation.findUnique({
      where: { token_hash: tokenHash },
      include: { firm: true },
    });

    if (!invitation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Convite não encontrado.' },
        },
        { status: 404 },
      );
    }

    // Verificar se já foi aceite
    if (invitation.accepted_at) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ALREADY_ACCEPTED', message: 'Este convite já foi utilizado.' },
        },
        { status: 410 },
      );
    }

    // Verificar se expirou
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'EXPIRED', message: 'Este convite expirou.' },
        },
        { status: 410 },
      );
    }

    // Parsear corpo
    const body = await request.json();
    const { full_name, password, password_confirmation } = body as {
      full_name?: string;
      password?: string;
      password_confirmation?: string;
    };

    const errors: string[] = [];

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.length > 255) {
      errors.push('Nome completo deve ter entre 2 e 255 caracteres.');
    }

    if (!password || !isValidPassword(password)) {
      errors.push(
        'Palavra-passe deve ter entre 8 e 128 caracteres, incluindo maiúscula, minúscula, número e carácter especial (@$!%*?&).',
      );
    }

    if (password !== password_confirmation) {
      errors.push('A palavra-passe e a confirmação não coincidem.');
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

    // Verificar se email já existe globalmente (outro escritório)
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONFLICT', message: 'Este email já está registado.' },
        },
        { status: 409 },
      );
    }

    // Hash da password
    const passwordHash = await hashPassword(password);

    // Criar utilizador
    const user = await db.user.create({
      data: {
        firm_id: invitation.firm_id,
        email: invitation.email,
        password_hash: passwordHash,
        full_name: full_name.trim(),
        role: invitation.role,
      },
    });

    // Marcar convite como aceite
    await db.invitation.update({
      where: { id: invitation.id },
      data: { accepted_at: new Date() },
    });

    // Gerar tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      firm_id: user.firm_id,
    });

    const refreshToken = generateRefreshToken({ sub: user.id });

    // Hash e guardar refresh token
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Usar executeRaw para evitar Prisma relation populate bloqueado por RLS
    const refreshTokenId = randomUUID();
    await db.$executeRaw`
      INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, ip_address, device_info, created_at)
      VALUES (${refreshTokenId}::uuid, ${user.id}::uuid, ${refreshTokenHash}, ${expiresAt}::timestamptz,
              ${request.headers.get('x-forwarded-for') ?? null}, ${request.headers.get('user-agent') ?? null}, now()::timestamptz)
    `;

    // Log de auditoria
    logAudit({
      firm_id: invitation.firm_id,
      user_id: user.id,
      action: 'USER_CREATED_VIA_INVITATION',
      entity_type: 'User',
      entity_id: user.id,
      new_values: {
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        invitation_id: invitation.id,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

    logAudit({
      firm_id: invitation.firm_id,
      user_id: user.id,
      action: 'INVITATION_ACCEPTED',
      entity_type: 'Invitation',
      entity_id: invitation.id,
      new_values: {
        email: invitation.email,
        role: invitation.role,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? undefined,
      user_agent: request.headers.get('user-agent') ?? undefined,
    });

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
      { status: 201 },
    );
  } catch (error) {
    console.error('[INVITATION_ACCEPT] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
