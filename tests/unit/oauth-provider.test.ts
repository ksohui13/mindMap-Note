import { describe, expect, it } from "vitest";

import {
  getEnabledOAuthProviders,
  getOAuthRedirectUri,
} from "@/server/auth/oauth-provider";
import { getOAuthErrorMessage } from "@/shared/auth/oauth";

describe("OAuth provider configuration", () => {
  it("enables only providers with complete credentials", () => {
    expect(getEnabledOAuthProviders({
      APP_BASE_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    })).toEqual(["google"]);
  });

  it("builds a fixed callback URL from APP_BASE_URL", () => {
    expect(getOAuthRedirectUri("kakao", {
      APP_BASE_URL: "http://localhost:3000",
    })).toBe("http://localhost:3000/api/auth/oauth/kakao/callback");
  });

  it("maps only known callback errors to user-safe messages", () => {
    expect(getOAuthErrorMessage("OAUTH_STATE_INVALID")).toMatch(/만료/);
    expect(getOAuthErrorMessage("provider raw error")).toBeUndefined();
  });
});
