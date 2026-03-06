import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client/client'

// Force load .env file to override system environment variables
const envPath = resolve(process.cwd(), '.env')
const envResult = config({ path: envPath, override: true })

if (envResult.error) {
  console.error('Failed to load .env file:', envResult.error.message)
} else {
  console.log('Loaded .env file from:', envPath)
}

// Get database URL from environment
// Try NEXT_DATABASE_URL first (set by next.config.ts), then DATABASE_URL from .env
let databaseUrl = process.env.NEXT_DATABASE_URL || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is not set!')
  throw new Error('DATABASE_URL environment variable is required')
}

// Strip surrounding quotes (env files often leave them in)
databaseUrl = databaseUrl.replace(/^["']|["']$/g, '').trim()
// Use explicit sslmode=verify-full to avoid pg-connection-string deprecation warning (prefer/require/verify-ca → verify-full)
databaseUrl = databaseUrl.replace(/sslmode=(prefer|require|verify-ca)/gi, 'sslmode=verify-full')

const adapter = new PrismaPg({ connectionString: databaseUrl })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
