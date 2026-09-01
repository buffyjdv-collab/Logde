// This module sets process.env BEFORE Prisma is imported.
// Import it as the very first import in db.ts.
import { DATABASE_URL, DIRECT_URL } from './db-config';

// Set the env vars that the Prisma schema references.
// This runs before @prisma/client is imported (module evaluation order).
if (DATABASE_URL) {
  process.env.NEON_DATABASE_URL = DATABASE_URL;
}
if (DIRECT_URL) {
  process.env.NEON_DIRECT_URL = DIRECT_URL;
}
