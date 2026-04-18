// ═══════════════════════════════════════════════════════════════
// LEXDOC — Middleware de Autenticação para Rotas Protegidas
// Extrai e verifica token JWT do header Authorization
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type TokenPayload } from '@/lib/auth';

// Fuso horário de Moçambique
process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface AuthenticatedRequest extends NextRequest {
  auth: TokenPayload;
}

// ─────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────

/**
 * Middleware helper: extrair e verificar token JWT do header Authorization.
 * Retorna o payload autenticado ou uma resposta de erro 401.
 */
export function authenticateRequest(
  request: NextRequest
): {
  success: true;
  payload: TokenPayload;
  req: AuthenticatedRequest;
} | {
  success: false;
  response: NextResponse;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas.' },
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas.' },
        },
        { status: 401 }
      ),
    };
  }

  // Associar dados de autenticação ao objecto request
  (request as AuthenticatedRequest).auth = payload;
  return { success: true, payload, req: request as AuthenticatedRequest };
}
