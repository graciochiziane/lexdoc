// ═══════════════════════════════════════════════════════════════
// LEXDOC — Middleware de Segurança (Safety Net)
// Protege todas as rotas /api/v1/* excepto endpoints públicos
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

// Rotas públicas que não requerem autenticação
const PUBLIC_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/invitations/',
  '/api/v1/health',
];

// Rotas que são completamente públicas (health check, etc.)
const SKIP_PATHS = [
  '/api/',
  '/_next/',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar rotas que não são API v1
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // Permitir rotas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar presença do header Authorization
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Autenticação necessária.',
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
