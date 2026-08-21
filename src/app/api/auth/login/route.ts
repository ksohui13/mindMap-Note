import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loginInputSchema } from "@/features/auth/model/validation";
import { setSessionCookie } from "@/server/auth/cookie";
import { login } from "@/server/auth/service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = loginInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const result = await login(parsed.data);
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
