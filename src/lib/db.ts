import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

// ─────────────────────────────────────────────────────────────
// Middleware: Geração automática de UUIDs para todos os creates
// Resolve o problema de UUID defaults inválidos no Supabase
// ─────────────────────────────────────────────────────────────
db.$use(async (params, next) => {
  if (params.action === 'create' && params.args.data) {
    const data = params.args.data as Record<string, unknown>
    if (!data.id) {
      data.id = randomUUID()
    }
    params.args.data = data
  }
  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
