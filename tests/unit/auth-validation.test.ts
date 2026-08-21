import { describe, expect, it } from "vitest";

import {
  loginInputSchema,
  signupInputSchema,
} from "@/features/auth/model/validation";

describe("auth validation", () => {
  it("normalizes email and accepts login credentials", () => {
    expect(
      loginInputSchema.parse({ email: "  User@Example.COM ", password: "secret" }),
    ).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("rejects invalid email and short signup password", () => {
    expect(signupInputSchema.safeParse({ email: "invalid", password: "short" }).success).toBe(false);
  });

  it("rejects bcrypt-truncated passwords over 72 UTF-8 bytes", () => {
    expect(
      signupInputSchema.safeParse({
        email: "user@example.test",
        password: "가".repeat(25),
      }).success,
    ).toBe(false);
  });
});
