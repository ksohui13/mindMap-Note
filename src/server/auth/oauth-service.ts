import "server-only";

import { timingSafeEqual } from "node:crypto";
import * as oidc from "openid-client";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { DomainError } from "@/server/domain/errors";
import {
  createOAuthAccount,
  createOAuthAttempt,
  deleteExpiredOAuthAttempts,
  deleteOAuthAttemptByStateHash,
  findOAuthAccount,
  findOAuthAttemptByStateHash,
} from "@/server/domain/oauth.repository";
import { createUser, findUserByEmail } from "@/server/domain/user.repository";
import {
  OAUTH_ATTEMPT_DURATION_MS,
} from "@/shared/auth/constants";

import { AuthError } from "./errors";
import {
  buildOAuthAuthorizationUrl,
  exchangeOAuthAuthorizationCode,
  type OAuthIdentity,
  type OAuthProvider,
} from "./oauth-provider";
import { createSessionForUser, type AuthResult } from "./service";
import { hashOAuthState } from "./token";

export type OAuthStartResult = Readonly<{ state: string; redirectTo: URL }>;

export async function beginOAuth(
  provider: OAuthProvider,
  environment: Record<string, string | undefined> = process.env,
  client: PrismaClient = prisma,
): Promise<OAuthStartResult> {
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const redirectTo = await buildOAuthAuthorizationUrl(
    { provider, state, nonce, codeVerifier },
    environment,
  );

  await deleteExpiredOAuthAttempts(new Date(), client);
  await createOAuthAttempt(
    {
      stateHash: hashOAuthState(state),
      provider,
      codeVerifier,
      nonce,
      expiresAt: new Date(Date.now() + OAUTH_ATTEMPT_DURATION_MS),
    },
    client,
  );
  return { state, redirectTo };
}

export async function completeOAuth(
  provider: OAuthProvider,
  callbackUrl: URL,
  cookieState: string | undefined,
  environment: Record<string, string | undefined> = process.env,
  client: PrismaClient = prisma,
): Promise<AuthResult> {
  const returnedState = callbackUrl.searchParams.get("state");
  if (
    !returnedState ||
    !cookieState ||
    !safeEqual(returnedState, cookieState)
  ) {
    throw invalidOAuthState();
  }

  const stateHash = hashOAuthState(cookieState);
  const attempt = await findOAuthAttemptByStateHash(stateHash, client);
  if (
    !attempt ||
    attempt.provider !== provider ||
    attempt.expiresAt.getTime() <= Date.now()
  ) {
    if (attempt) await deleteOAuthAttemptByStateHash(stateHash, client);
    throw invalidOAuthState();
  }

  if (!await deleteOAuthAttemptByStateHash(stateHash, client)) {
    throw invalidOAuthState();
  }
  if (callbackUrl.searchParams.has("error")) {
    throw new AuthError(
      "OAUTH_PROVIDER_REJECTED",
      "소셜 로그인이 취소되었거나 승인되지 않았습니다.",
    );
  }

  const identity = await exchangeOAuthAuthorizationCode(
    {
      provider,
      state: cookieState,
      nonce: attempt.nonce,
      codeVerifier: attempt.codeVerifier,
      callbackUrl,
    },
    environment,
  );
  return completeOAuthIdentity(identity, client);
}

export async function completeOAuthIdentity(
  identity: OAuthIdentity,
  client: PrismaClient = prisma,
): Promise<AuthResult> {
  try {
    return await client.$transaction(async (transaction) => {
      const account = await findOAuthAccount(
        identity.provider,
        identity.providerAccountId,
        transaction,
      );
      if (account) return createSessionForUser(account.user, transaction);

      if (await findUserByEmail(identity.email, transaction)) {
        throw new AuthError(
          "OAUTH_ACCOUNT_CONFLICT",
          "같은 이메일의 기존 계정이 있습니다. 기존 로그인 방식을 이용해 주세요.",
        );
      }

      const user = await createUser(
        { email: identity.email, passwordHash: null },
        transaction,
      );
      await createOAuthAccount(
        {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
          userId: user.id,
        },
        transaction,
      );
      return createSessionForUser(user, transaction);
    });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof DomainError && error.code === "CONFLICT") {
      throw new AuthError(
        "OAUTH_ACCOUNT_CONFLICT",
        "이미 사용 중인 소셜 계정 또는 이메일입니다.",
        error,
      );
    }
    throw error;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function invalidOAuthState(): AuthError {
  return new AuthError(
    "OAUTH_STATE_INVALID",
    "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
  );
}
