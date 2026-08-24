import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import {
  clearOAuthStateCookie,
  setOAuthStateCookie,
} from "@/server/auth/cookie";

describe("OAuth state cookie", () => {
  it("uses short-lived HttpOnly SameSite=Lax protection", () => {
    const response = NextResponse.redirect("http://localhost/provider");
    setOAuthStateCookie(response, "state-value");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mindmap_oauth_state=state-value");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/api/auth/oauth");
    expect(cookie).toContain("Max-Age=600");
  });

  it("clears the exact OAuth cookie scope", () => {
    const response = NextResponse.redirect("http://localhost/login");
    clearOAuthStateCookie(response);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mindmap_oauth_state=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/api/auth/oauth");
  });
});
