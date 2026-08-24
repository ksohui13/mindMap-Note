import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { setOAuthStateCookie } from "@/server/auth/cookie";
import { beginOAuth } from "@/server/auth/oauth-service";
import { oauthErrorRedirect } from "@/server/auth/oauth-route";
import { oauthProviderSchema } from "@/server/auth/oauth-provider";

type OAuthRouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: OAuthRouteContext) {
  try {
    const provider = oauthProviderSchema.parse((await context.params).provider);
    const result = await beginOAuth(provider);
    const response = NextResponse.redirect(result.redirectTo);
    response.headers.set("Cache-Control", "no-store");
    setOAuthStateCookie(response, result.state);
    return response;
  } catch (error) {
    return oauthErrorRedirect(request, error);
  }
}
