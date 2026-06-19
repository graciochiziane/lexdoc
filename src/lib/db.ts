import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

// NOTA: $use() foi removido no Prisma 6 — use client extensions se necessário.
// Todos os creates já passam UUIDs explícitos via randomUUID().

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
