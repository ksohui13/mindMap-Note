import type { Prisma, Session } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";

import { mapPrismaError } from "./errors";
import { normalizeTokenHash } from "./normalization";

export type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type SessionWithUser = Prisma.SessionGetPayload<{
  include: { user: { select: { id: true; email: true } } };
}>;

export async function createSession(
  input: CreateSessionInput,
  client: DatabaseClient = prisma,
): Promise<Session> {
  try {
    return await client.session.create({
      data: {
        userId: input.userId,
        tokenHash: normalizeTokenHash(input.tokenHash),
        expiresAt: input.expiresAt,
      },
    });
  } catch (error) {
    return mapPrismaError(error);
  }
}

export function findSessionByTokenHash(
  tokenHash: string,
  client: DatabaseClient = prisma,
): Promise<Session | null> {
  return client.session.findUnique({
    where: { tokenHash: normalizeTokenHash(tokenHash) },
  });
}

export async function deleteSession(
  id: string,
  client: DatabaseClient = prisma,
): Promise<void> {
  await client.session.deleteMany({ where: { id } });
}

export async function deleteSessionByTokenHash(
  tokenHash: string,
  client: DatabaseClient = prisma,
): Promise<void> {
  await client.session.deleteMany({
    where: { tokenHash: normalizeTokenHash(tokenHash) },
  });
}

export function findSessionWithUserByTokenHash(
  tokenHash: string,
  client: DatabaseClient = prisma,
): Promise<SessionWithUser | null> {
  return client.session.findUnique({
    where: { tokenHash: normalizeTokenHash(tokenHash) },
    include: { user: { select: { id: true, email: true } } },
  });
}

export async function deleteExpiredSessions(
  now: Date = new Date(),
  client: DatabaseClient = prisma,
): Promise<number> {
  const result = await client.session.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  return result.count;
}
