import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUserFromToken } from "@/server/auth/session";
import { errorResponse } from "@/server/http/api";
import { SESSION_COOKIE_NAME } from "@/shared/auth/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromToken(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 },
      );
    }
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
