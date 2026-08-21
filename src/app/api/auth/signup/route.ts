import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { signupInputSchema } from "@/features/auth/model/validation";
import { setSessionCookie } from "@/server/auth/cookie";
import { signup } from "@/server/auth/service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = signupInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const result = await signup(parsed.data);
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
