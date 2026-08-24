import type { OAuthAccount, OAuthAttempt } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";
import type { OAuthProvider } from "@/shared/auth/oauth";

import { mapPrismaError } from "./errors";
import { normalizeTokenHash } from "./normalization";

export type CreateOAuthAttemptInput = Readonly<{
  stateHash: string;
  provider: OAuthProvider;
  codeVerifier: string;
  nonce: string;
  expiresAt: Date;
}>;

export async function createOAuthAttempt(
  input: CreateOAuthAttemptInput,
  client: DatabaseClient = prisma,
): Promise<OAuthAttempt> {
  try {
    return await client.oAuthAttempt.create({
      data: { ...input, stateHash: normalizeTokenHash(input.stateHash) },
    });
  } catch (error) {
    return mapPrismaError(error);
  }
}

export function findOAuthAttemptByStateHash(
  stateHash: string,
  client: DatabaseClient = prisma,
): Promise<OAuthAttempt | null> {
  return client.oAuthAttempt.findUnique({
    where: { stateHash: normalizeTokenHash(stateHash) },
  });
}

export async function deleteOAuthAttemptByStateHash(
  stateHash: string,
  client: DatabaseClient = prisma,
): Promise<boolean> {
  const result = await client.oAuthAttempt.deleteMany({
    where: { stateHash: normalizeTokenHash(stateHash) },
  });
  return result.count === 1;
}

export async function deleteExpiredOAuthAttempts(
  now: Date = new Date(),
  client: DatabaseClient = prisma,
): Promise<number> {
  const result = await client.oAuthAttempt.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return result.count;
}

export function findOAuthAccount(
  provider: OAuthProvider,
  providerAccountId: string,
  client: DatabaseClient = prisma,
): Promise<(OAuthAccount & { user: { id: string; email: string } }) | null> {
  return client.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: { select: { id: true, email: true } } },
  });
}

export async function createOAuthAccount(
  input: Readonly<{ provider: OAuthProvider; providerAccountId: string; userId: string }>,
  client: DatabaseClient = prisma,
): Promise<OAuthAccount> {
  try {
    return await client.oAuthAccount.create({ data: input });
  } catch (error) {
    return mapPrismaError(error);
  }
}
