import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { completeOAuth } from "@/server/auth/oauth-service";

const repository = vi.hoisted(() => ({
  createOAuthAccount: vi.fn(),
  createOAuthAttempt: vi.fn(),
  deleteExpiredOAuthAttempts: vi.fn(),
  deleteOAuthAttemptByStateHash: vi.fn(),
  findOAuthAccount: vi.fn(),
  findOAuthAttemptByStateHash: vi.fn(),
}));
const exchangeOAuthAuthorizationCode = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ prisma: {} }));
vi.mock("@/server/domain/oauth.repository", () => repository);
vi.mock("@/server/auth/oauth-provider", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/oauth-provider")>();
  return { ...original, exchangeOAuthAuthorizationCode };
});

const client = {} as PrismaClient;

function callback(state: string) {
  return new URL(
    `http://localhost:3000/api/auth/oauth/google/callback?code=code&state=${state}`,
  );
}

describe("OAuth attempt validation", () => {
  it("rejects a callback that is not bound to the initiating browser cookie", async () => {
    await expect(completeOAuth(
      "google",
      callback("returned-state"),
      "cookie-state",
      {},
      client,
    )).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
    expect(repository.findOAuthAttemptByStateHash).not.toHaveBeenCalled();
  });

  it("deletes and rejects an expired attempt before token exchange", async () => {
    repository.findOAuthAttemptByStateHash.mockResolvedValueOnce({
      provider: "google",
      expiresAt: new Date(Date.now() - 1_000),
      nonce: "nonce",
      codeVerifier: "verifier",
    });
    repository.deleteOAuthAttemptByStateHash.mockResolvedValueOnce(true);

    await expect(completeOAuth(
      "google",
      callback("same-state"),
      "same-state",
      {},
      client,
    )).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
    expect(repository.deleteOAuthAttemptByStateHash).toHaveBeenCalledTimes(1);
    expect(exchangeOAuthAuthorizationCode).not.toHaveBeenCalled();
  });

  it("rejects an already consumed attempt", async () => {
    repository.findOAuthAttemptByStateHash.mockResolvedValueOnce({
      provider: "google",
      expiresAt: new Date(Date.now() + 60_000),
      nonce: "nonce",
      codeVerifier: "verifier",
    });
    repository.deleteOAuthAttemptByStateHash.mockResolvedValueOnce(false);

    await expect(completeOAuth(
      "google",
      callback("single-use-state"),
      "single-use-state",
      {},
      client,
    )).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
    expect(exchangeOAuthAuthorizationCode).not.toHaveBeenCalled();
  });
});
