import { beforeEach, describe, expect, it, vi } from "vitest";

import { exchangeOAuthAuthorizationCode } from "@/server/auth/oauth-provider";

const { authorizationCodeGrant } = vi.hoisted(() => ({
  authorizationCodeGrant: vi.fn(),
}));

vi.mock("openid-client", () => ({
  ClientSecretPost: vi.fn(() => vi.fn()),
  authorizationCodeGrant,
  discovery: vi.fn(async () => ({ configuration: true })),
}));

const environment = {
  APP_BASE_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
};

function callbackInput() {
  return {
    provider: "google" as const,
    state: "state",
    nonce: "nonce",
    codeVerifier: "verifier",
    callbackUrl: new URL(
      "http://localhost:3000/api/auth/oauth/google/callback?code=code&state=state",
    ),
  };
}

beforeEach(() => authorizationCodeGrant.mockReset());

describe("OAuth identity validation", () => {
  it("accepts a verified Google email", async () => {
    authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: "google-sub",
        email: "User@Example.test",
        email_verified: true,
      }),
    });
    await expect(exchangeOAuthAuthorizationCode(
      callbackInput(),
      environment,
    )).resolves.toEqual({
      provider: "google",
      providerAccountId: "google-sub",
      email: "User@Example.test",
    });
  });

  it("rejects an unverified Google email", async () => {
    authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: "google-sub",
        email: "user@example.test",
        email_verified: false,
      }),
    });
    await expect(exchangeOAuthAuthorizationCode(
      callbackInput(),
      environment,
    )).rejects.toMatchObject({ code: "OAUTH_EMAIL_REQUIRED" });
  });
});
