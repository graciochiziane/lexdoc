import { PrismaClient } from '@prisma/client'

/**
 * Corrige a DATABASE_URL para PgBouncer:
 * Adiciona ?pgbouncer=true para desactivar prepared statements,
 * evitando o erro "prepared statement does not exist" (code 26000).
 * O PgBouncer em transaction mode não suporta prepared statements
 * porque cada query pode ser roteada para uma conexão diferente.
 */
function getPgBouncerUrl(originalUrl: string): string {
  if (!originalUrl.startsWith('postgresql://') && !originalUrl.startsWith('postgres://')) {
    return originalUrl // SQLite ou outros — não modificar
  }
  // Se já tem pgbouncer=true, não duplicar
  if (originalUrl.includes('pgbouncer=true')) return originalUrl
  const separator = originalUrl.includes('?') ? '&' : '?'
  return `${originalUrl}${separator}pgbouncer=true`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = getPgBouncerUrl(process.env.DATABASE_URL ?? '')

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

// NOTA: $use() foi removido no Prisma 6 — use client extensions se necessário.
// Todos os creates já passam UUIDs explícitos via randomUUID().

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
