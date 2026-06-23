// ═══════════════════════════════════════════════════════════════
// LEXDOC — Validação de Convite (público)
// GET /api/v1/invitations/[token] — Validar token de convite
// DELETE /api/v1/invitations/[token] — Revogar convite (ADMIN)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { hasRole } from '@/lib/rbac';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// GET: Validar token (público, sem autenticação)
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await db.invitation.findUnique({
      where: { token_hash: tokenHash },
      include: {
        firm: {
          select: { name: true },
        },
      },
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

    return NextResponse.json({
      success: true,
      data: {
        firm_name: invitation.firm.name,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('[INVITATION_VALIDATE] Erro:', error);
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
// DELETE: Revogar convite (ADMIN)
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const auth = authenticateRequest(request);
  if (!auth.success) return auth.response;

  const { payload, req } = auth;

  if (!hasRole(payload.role, ['ADMIN'])) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Acesso negado.' },
      },
      { status: 403 },
    );
  }

  try {
    const { token } = await params;

    // Buscar convite pelo ID (quando revogado da listagem) ou por token_hash
    let invitation = await db.invitation.findUnique({
      where: { id: token },
    });

    if (!invitation) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      invitation = await db.invitation.findUnique({
        where: { token_hash: tokenHash },
      });
    }

    if (!invitation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Convite não encontrado.' },
        },
        { status: 404 },
      );
    }

    // Verificar se pertence ao escritório do utilizador
    if (invitation.firm_id !== payload.firm_id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Acesso negado.' },
        },
        { status: 403 },
      );
    }

    // Eliminar convite
    await db.invitation.delete({
      where: { id: invitation.id },
    });

    // Log de auditoria
    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'INVITATION_REVOKED',
      entity_type: 'Invitation',
      entity_id: invitation.id,
      old_values: {
        email: invitation.email,
        role: invitation.role,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Convite revogado com sucesso.' },
    });
  } catch (error) {
    console.error('[INVITATION_DELETE] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
      },
      { status: 500 },
    );
  }
}
