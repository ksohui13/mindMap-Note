import "server-only";

import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/shared/auth/constants";
import { ApiError } from "@/server/http/api";

import { getCurrentUserFromToken, type CurrentUser } from "./session";

export async function requireApiUser(request: NextRequest): Promise<CurrentUser> {
  const user = await getCurrentUserFromToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  return user;
}
