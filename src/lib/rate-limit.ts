// ═══════════════════════════════════════════════════════════════
// LEXDOC — Rate Limiter em Memória
// Limite de tentativas por chave (IP, email, etc.) sem Redis
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─────────────────────────────────────────
// Armazenamento em memória
// ─────────────────────────────────────────
const store = new Map<string, RateLimitEntry>();

// Intervalo de limpeza de entradas expiradas (60 segundos)
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/** Remover entradas expiradas do armazenamento */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/** Garantir que o temporizador de limpeza está activo */
function ensureCleanupTimer(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    // Não impedir o encerramento do processo
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

// ─────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Verificar se uma chave atingiu o limite de tentativas.
 * @param key - Identificador único (ex: IP, email)
 * @param maxAttempts - Número máximo de tentativas na janela
 * @param windowMs - Janela de tempo em milissegundos
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  ensureCleanupTimer();

  const now = Date.now();

  // Buscar entrada existente
  const entry = store.get(key);

  // Se não existe ou já expirou — criar nova entrada
  if (!entry || entry.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Incrementar contagem
  entry.count += 1;

  // Verificar se excedeu o limite
  if (entry.count > maxAttempts) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Mensagem padrão para limite excedido */
export const RATE_LIMIT_MESSAGE =
  'Demasiadas tentativas. Tente novamente em breve.';
