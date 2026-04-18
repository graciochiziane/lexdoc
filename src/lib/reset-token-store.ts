// ═══════════════════════════════════════════════════════════════
// LEXDOC — Armazenamento em memória de tokens de reset
// Módulo compartilhado entre forgot-password e reset-password
// ═══════════════════════════════════════════════════════════════

import { hashToken } from '@/lib/auth';
import crypto from 'crypto';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ResetTokenEntry {
  tokenHash: string;
  rawToken: string;
  userId: string;
  firmId: string;
  expiresAt: number;
}

// ─────────────────────────────────────────
// Armazenamento (keyed by userId for fast lookup)
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
export function createResetToken(
  userId: string,
  firmId: string,
  expiryMs: number,
): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = Date.now() + expiryMs;

  ensureCleanupTimer();
  store.set(userId, {
    tokenHash,
    rawToken,
    userId,
    firmId,
    expiresAt,
  });

  return rawToken;
}

/** Buscar entrada de reset por token raw (comparação SHA-256). */
export function getResetTokenEntry(
  rawToken: string,
): ResetTokenEntry | null {
  const tokenHash = hashToken(rawToken);
  for (const entry of store.values()) {
    if (entry.tokenHash === tokenHash) {
      return entry;
    }
  }
  return null;
}

/** Remover token de reset por userId. */
export function deleteResetToken(userId: string): void {
  store.delete(userId);
}
