import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type DatabaseClient = PrismaClient | Prisma.TransactionClient;
