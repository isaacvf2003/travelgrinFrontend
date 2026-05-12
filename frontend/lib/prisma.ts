import { PrismaClient } from "@prisma/client";

/**
 * Prevent exhausting your database connection limit in development
 * by reusing the PrismaClient instance across hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
