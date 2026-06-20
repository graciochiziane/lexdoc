// ═══════════════════════════════════════════════════════════════
// LEXDOC — Serviço de Auditoria Assíncrona
// Regista eventos de forma não-bloqueante — nunca lançar excepções
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

// ─────────────────────────────────────────
// Campos PII que devem ser mascarados
// ─────────────────────────────────────────
const PII_FIELDS = [
  'bi_number',
  'nif',
  'phone',
  'address',
  'password_hash',
  'mfa_secret',
  'mfa_backup_codes',
];

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface AuditLogPayload {
  firm_id?: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────

/** Mascarar campos PII num objecto — substitui valores por "[REDACTED]" */
function redactPII(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursão para objectos aninhados
      redacted[key] = redactPII(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/** Serializar para JSON String (necessário para SQLite) */
function safeStringify(data: Record<string, unknown> | undefined): string | null {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Função principal — chamada SEM await
// ─────────────────────────────────────────

/** Registar evento de auditoria de forma assíncrona (fire-and-forget) */
export function logAudit(payload: AuditLogPayload): void {
  // Executar de forma assíncrona — nunca bloquear o fluxo principal
  void (async () => {
    try {
      const redactedOld = payload.old_values
        ? safeStringify(redactPII(payload.old_values))
        : null;
      const redactedNew = payload.new_values
        ? safeStringify(redactPII(payload.new_values))
        : null;
      const serializedMeta = payload.metadata
        ? safeStringify(payload.metadata)
        : null;

      const id = randomUUID();

      // Guardar com Prisma (seguro, funciona com PgBouncer e SQLite)
      await db.auditLog.create({
        data: {
          id,
          firm_id: payload.firm_id,
          user_id: payload.user_id,
          action: payload.action,
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          old_values: redactedOld,
          new_values: redactedNew,
          ip_address: payload.ip_address,
          user_agent: payload.user_agent,
          metadata: serializedMeta,
        },
      });
    } catch {
      // Silencioso — nunca propagar erros de auditoria
    }
  })();
}
