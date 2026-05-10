import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Enable WAL mode for better concurrency and crash safety with SQLite
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;")
  .then(() => prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL;"))
  .catch(() => { /* best-effort — ignored in non-SQLite setups */ });
