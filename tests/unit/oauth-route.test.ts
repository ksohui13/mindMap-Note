import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as callbackRoute } from "@/app/api/auth/oauth/[provider]/callback/route";
import { GET as startRoute } from "@/app/api/auth/oauth/[provider]/start/route";
import { AuthError } from "@/server/auth/errors";
import { beginOAuth, completeOAuth } from "@/server/auth/oauth-service";

vi.mock("@/server/auth/oauth-service", () => ({
  beginOAuth: vi.fn(),
  completeOAuth: vi.fn(),
}));

const beginOAuthMock = vi.mocked(beginOAuth);
const completeOAuthMock = vi.mocked(completeOAuth);
const originalBaseUrl = process.env.APP_BASE_URL;

beforeEach(() => {
  beginOAuthMock.mockReset();
  completeOAuthMock.mockReset();
  process.env.APP_BASE_URL = "http://localhost:3000";
});

describe("OAuth routes", () => {
  it("starts authorization with a short-lived state cookie", async () => {
    beginOAuthMock.mockResolvedValue({
      state: "generated-state",
      redirectTo: new URL("https://accounts.example/authorize"),
    });
    const response = await startRoute(
      new NextRequest("http://localhost:3000/api/auth/oauth/google/start"),
      { params: Promise.resolve({ provider: "google" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.example/authorize");
    expect(response.headers.get("set-cookie")).toContain(
      "mindmap_oauth_state=generated-state",
    );
  });

  it("sets the existing app session after a successful callback", async () => {
    completeOAuthMock.mockResolvedValue({
      user: { id: "user-id", email: "oauth@example.test" },
      session: {
        token: "session-token",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    const request = new NextRequest(
      "http://localhost:3000/api/auth/oauth/google/callback?code=code&state=state",
      { headers: { cookie: "mindmap_oauth_state=state" } },
    );
    const response = await callbackRoute(request, {
      params: Promise.resolve({ provider: "google" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    const cookies = response.headers.getSetCookie().join(";");
    expect(cookies).toContain("mindmap_session=session-token");
    expect(cookies).toContain("mindmap_oauth_state=");
  });

  it("returns a safe login error and clears state after callback failure", async () => {
    completeOAuthMock.mockRejectedValue(
      new AuthError("OAUTH_STATE_INVALID", "internal state detail"),
    );
    const request = new NextRequest(
      "http://localhost:3000/api/auth/oauth/kakao/callback?state=bad",
      { headers: { cookie: "mindmap_oauth_state=other" } },
    );
    const response = await callbackRoute(request, {
      params: Promise.resolve({ provider: "kakao" }),
    });

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?oauthError=OAUTH_STATE_INVALID",
    );
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });
});

afterAll(() => {
  process.env.APP_BASE_URL = originalBaseUrl;
});
