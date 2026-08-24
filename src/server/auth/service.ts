import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { LoginInput, SignupInput } from "@/features/auth/model/validation";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";
import { DomainError } from "@/server/domain/errors";
import { createSession, deleteSessionByTokenHash } from "@/server/domain/session.repository";
import { createUser, findUserByEmail } from "@/server/domain/user.repository";
import { SESSION_DURATION_MS } from "@/shared/auth/constants";

import { AuthError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./token";

export type AuthResult = {
  user: { id: string; email: string };
  session: { token: string; expiresAt: Date };
};

function createSessionMaterial() {
  const token = generateSessionToken();
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  };
}

export async function createSessionForUser(
  user: Readonly<{ id: string; email: string }>,
  client: DatabaseClient = prisma,
): Promise<AuthResult> {
  const session = createSessionMaterial();
  await createSession(
    {
      userId: user.id,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
    },
    client,
  );
  return {
    user: { id: user.id, email: user.email },
    session: { token: session.token, expiresAt: session.expiresAt },
  };
}

export async function signup(
  input: SignupInput,
  client: PrismaClient = prisma,
): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  const session = createSessionMaterial();

  try {
    return await client.$transaction(async (transaction) => {
      const user = await createUser(
        { email: input.email, passwordHash },
        transaction,
      );
      await createSession(
        {
          userId: user.id,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
        },
        transaction,
      );

      return {
        user: { id: user.id, email: user.email },
        session: { token: session.token, expiresAt: session.expiresAt },
      };
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "CONFLICT") {
      throw new AuthError(
        "EMAIL_ALREADY_EXISTS",
        "이미 가입된 이메일입니다.",
        error,
      );
    }
    throw error;
  }
}

export async function login(
  input: LoginInput,
  client: PrismaClient = prisma,
): Promise<AuthResult> {
  const user = await findUserByEmail(input.email, client);
  const passwordMatches = await verifyPassword(
    input.password,
    user?.passwordHash ?? null,
  );

  if (!user || !passwordMatches) {
    throw new AuthError(
      "INVALID_CREDENTIALS",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  const session = createSessionMaterial();
  await createSession(
    {
      userId: user.id,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
    },
    client,
  );

  return {
    user: { id: user.id, email: user.email },
    session: { token: session.token, expiresAt: session.expiresAt },
  };
}

export async function logout(
  token: string | undefined,
  client: PrismaClient = prisma,
): Promise<void> {
  if (!token) return;
  await deleteSessionByTokenHash(hashSessionToken(token), client);
}
