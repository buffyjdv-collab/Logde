import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

/**
 * Load .env with override:true so that the real PostgreSQL credentials in
 * .env REPLACE any stale DATABASE_URL that the host environment might inject
 * (e.g. some sandboxes inject DATABASE_URL=file:... SQLite).
 *
 * On Vercel / production hosts that set DATABASE_URL directly, this is a
 * no-op (dotenv only overrides vars that are present in the .env file; if
 * .env doesn't exist or doesn't contain DATABASE_URL, the host value wins).
 */
config({ path: '.env', override: true })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
