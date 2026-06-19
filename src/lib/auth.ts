// ═══════════════════════════════════════════════════════════════
// LEXDOC — Utilitários de Autenticação (JWT + Password)
// ═══════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─────────────────────────────────────────
// Configuração JWT
// ─────────────────────────────────────────
const _JWT_SECRET = process.env.JWT_SECRET;
const _JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!_JWT_SECRET || _JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET não definida ou inferior a 32 caracteres. Defina no .env');
}
if (!_JWT_REFRESH_SECRET || _JWT_REFRESH_SECRET.length < 32) {
  throw new Error('FATAL: JWT_REFRESH_SECRET não definida ou inferior a 32 caracteres. Defina no .env');
}

// Após validação, garantir que TypeScript reconhece como string
const JWT_SECRET: string = _JWT_SECRET;
const JWT_REFRESH_SECRET: string = _JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

// ─────────────────────────────────────────
// Tipos exportados
// ─────────────────────────────────────────
export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  firm_id: string;
}

// ─────────────────────────────────────────
// Funções de Password
// ─────────────────────────────────────────

/** Gerar hash bcrypt da password (10 salt rounds) */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Verificar password contra hash bcrypt */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────
// Funções de Token JWT
// ─────────────────────────────────────────

/** Gerar token de acesso (curto prazo) */
export function generateAccessToken(payload: {
  sub: string;
  email: string;
  role: string;
  firm_id: string;
}): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    JWT_SECRET as jwt.Secret,
    { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions,
  );
}

/** Gerar token de actualização (longo prazo) */
export function generateRefreshToken(payload: { sub: string }): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    JWT_REFRESH_SECRET as jwt.Secret,
    { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions,
  );
}

/** Verificar e descodificar token de acesso — retorna null em caso de erro */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** Verificar e descodificar token de actualização — retorna null em caso de erro */
export function verifyRefreshToken(token: string): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as unknown as { sub: string };
    return decoded;
  } catch {
    return null;
  }
}

/** Gerar hash SHA-256 determinístico de token (para lookup na tabela refresh_tokens) */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
