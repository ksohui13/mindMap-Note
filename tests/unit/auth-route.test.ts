import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { signup } from "@/server/auth/service";

vi.mock("@/server/auth/service", () => ({
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const signupMock = vi.mocked(signup);

beforeEach(() => {
  signupMock.mockReset();
});

function signupRequest(body: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      origin,
    },
    body: JSON.stringify(body),
  });
}

describe("signup route", () => {
  it("returns a minimal user DTO and secure session cookie", async () => {
    signupMock.mockResolvedValue({
      user: { id: "user-id", email: "user@example.test" },
      session: {
        token: "opaque-token",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const response = await signupRoute(
      signupRequest({ email: "user@example.test", password: "password123" }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      user: { id: "user-id", email: "user@example.test" },
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mindmap_session=opaque-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).not.toContain("user@example.test");
  });

  it("rejects cross-origin requests before calling the service", async () => {
    const response = await signupRoute(
      signupRequest(
        { email: "user@example.test", password: "password123" },
        "https://evil.example",
      ),
    );
    expect(response.status).toBe(403);
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("returns stable field validation errors", async () => {
    const response = await signupRoute(
      signupRequest({ email: "invalid", password: "short" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { email: expect.any(Array), password: expect.any(Array) },
      },
    });
  });
});
