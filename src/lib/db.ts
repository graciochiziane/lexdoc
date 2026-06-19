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

// ─────────────────────────────────────────
// Middleware: Geração UUID client-side
// Garante que os IDs são gerados no lado da aplicação,
// evitando depender de defaults da BD que podem estar
// mal configurados no Supabase (ex: gen_random_uuid)
// ─────────────────────────────────────────
db.$use(async (params, next) => {
  // Antes de operações CREATE, injectar UUIDs nos campos `id`
  if (params.action === 'create') {
    const model = params.model
    const data = params.args.data as Record<string, unknown>

    // Gerar UUID para o campo `id` principal se não fornecido
    if (data && !data.id) {
      data.id = randomUUID()
    }

    params.args.data = data
  }

  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
