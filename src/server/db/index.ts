import "server-only";

// Next.js application code enters the database layer through this module.
// CLI tools and integration tests use client.ts directly because the
// `server-only` marker intentionally throws outside a React Server runtime.
export { createPrismaClient, prisma } from "./client";
export type { DatabaseClient } from "./types";
