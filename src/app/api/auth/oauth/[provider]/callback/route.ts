import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  clearOAuthStateCookie,
  setSessionCookie,
} from "@/server/auth/cookie";
import { completeOAuth } from "@/server/auth/oauth-service";
import { oauthErrorRedirect } from "@/server/auth/oauth-route";
import {
  getOAuthRedirectUri,
  oauthProviderSchema,
} from "@/server/auth/oauth-provider";
import { OAUTH_STATE_COOKIE_NAME } from "@/shared/auth/constants";
import { parseOAuthEnv } from "@/shared/config/env";

type OAuthRouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: OAuthRouteContext) {
  try {
    const provider = oauthProviderSchema.parse((await context.params).provider);
    const callbackUrl = new URL(getOAuthRedirectUri(provider));
    callbackUrl.search = request.nextUrl.search;
    const result = await completeOAuth(
      provider,
      callbackUrl,
      request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value,
    );
    const response = NextResponse.redirect(new URL("/", parseOAuthEnv().APP_BASE_URL));
    response.headers.set("Cache-Control", "no-store");
    clearOAuthStateCookie(response);
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    const response = oauthErrorRedirect(request, error);
    clearOAuthStateCookie(response);
    return response;
  }
}
