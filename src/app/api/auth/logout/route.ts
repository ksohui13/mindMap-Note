import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/server/auth/cookie";
import { logout } from "@/server/auth/service";
import { assertSameOrigin, errorResponse } from "@/server/http/api";
import { SESSION_COOKIE_NAME } from "@/shared/auth/constants";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    await logout(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    const response = errorResponse(error);
    clearSessionCookie(response);
    return response;
  }
}
