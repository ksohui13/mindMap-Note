import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { parseOAuthEnv } from "@/shared/config/env";

import { AuthError, type AuthErrorCode } from "./errors";

export function oauthErrorRedirect(
  request: NextRequest,
  error: unknown,
): NextResponse {
  const code: AuthErrorCode = error instanceof AuthError
    ? error.code
    : "OAUTH_PROVIDER_REJECTED";
  if (!(error instanceof AuthError)) {
    console.error("[oauth] Unexpected OAuth error");
  }
  let origin = request.nextUrl.origin;
  try {
    origin = parseOAuthEnv().APP_BASE_URL;
  } catch {
    // Keep the request origin so a malformed optional OAuth setting still returns safely.
  }
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("oauthError", code);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
