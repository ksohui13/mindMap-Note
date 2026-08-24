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
  KAKAO_CLIENT_ID: "kakao-id",
  KAKAO_CLIENT_SECRET: "kakao-secret",
};

function callbackInput(provider: "google" | "kakao") {
  return {
    provider,
    state: "state",
    nonce: "nonce",
    codeVerifier: "verifier",
    callbackUrl: new URL(
      `http://localhost:3000/api/auth/oauth/${provider}/callback?code=code&state=state`,
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
      callbackInput("google"),
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
      callbackInput("google"),
      environment,
    )).rejects.toMatchObject({ code: "OAUTH_EMAIL_REQUIRED" });
  });

  it("requires Kakao email validity and verification flags", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access-token",
      claims: () => ({ sub: "kakao-sub" }),
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        kakao_account: {
          email: "kakao@example.test",
          is_email_valid: true,
          is_email_verified: true,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    await expect(exchangeOAuthAuthorizationCode(
      callbackInput("kakao"),
      environment,
      fetchMock,
    )).resolves.toEqual({
      provider: "kakao",
      providerAccountId: "kakao-sub",
      email: "kakao@example.test",
    });
  });
});
