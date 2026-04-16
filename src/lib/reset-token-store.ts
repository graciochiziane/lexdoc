// ═══════════════════════════════════════════════════════════════
// LEXDOC — Armazenamento em memória de tokens de reset
// Módulo compartilhado entre forgot-password e reset-password
// ═══════════════════════════════════════════════════════════════

import { hashToken, verifyPassword } from '@/lib/auth';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ResetTokenEntry {
  tokenHash: string;
  userId: string;
  firmId: string;
  expiresAt: number;
}

// ─────────────────────────────────────────
// Armazenamento
// ─────────────────────────────────────────
const store = new Map<string, ResetTokenEntry>();

// Limpeza de tokens expirados a cada 5 minutos
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (entry.expiresAt <= now) {
          store.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

// ─────────────────────────────────────────
// Funções exportadas
// ─────────────────────────────────────────

/** Criar e armazenar um novo token de reset. Retorna o token raw. */
export async function createResetToken(
  userId: string,
  firmId: string,
  expiryMs: number,
): Promise<string> {
  const crypto = await import('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await hashToken(rawToken);
  const expiresAt = Date.now() + expiryMs;

  ensureCleanupTimer();
  store.set(userId, {
    tokenHash,
    userId,
    firmId,
    expiresAt,
  });

  return rawToken;
}

/** Buscar entrada de reset por token raw (comparação segura). */
export async function getResetTokenEntry(
  rawToken: string,
): Promise<ResetTokenEntry | null> {
  for (const entry of store.values()) {
    const isValid = await verifyPassword(rawToken, entry.tokenHash);
    if (isValid) {
      return entry;
    }
  }
  return null;
}

/** Remover token de reset por userId. */
export function deleteResetToken(userId: string): void {
  store.delete(userId);
}
