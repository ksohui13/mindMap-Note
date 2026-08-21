import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/shared/auth/constants";

describe("auth proxy", () => {
  it("redirects protected pages without a cookie", () => {
    const response = proxy(new NextRequest("http://localhost/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("allows a request with an optimistic session cookie", () => {
    const request = new NextRequest("http://localhost/");
    request.cookies.set(SESSION_COOKIE_NAME, "opaque-token");
    expect(proxy(request).status).toBe(200);
  });
});
