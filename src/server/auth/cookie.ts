import type { NextResponse } from "next/server";

import {
  OAUTH_ATTEMPT_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/shared/auth/constants";

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export function setOAuthStateCookie(
  response: NextResponse,
  state: string,
): void {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/oauth",
    maxAge: OAUTH_ATTEMPT_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/oauth",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
