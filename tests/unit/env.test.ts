import { describe, expect, it } from "vitest";

import { parseDatabaseEnv, parseServerEnv } from "@/shared/config/env";

describe("parseServerEnv", () => {
  it("accepts the required server configuration", () => {
    expect(
      parseServerEnv({
        DATABASE_URL: "postgresql://mindmap:mindmap@localhost:5432/mindmap",
        SESSION_SECRET: "a-secure-session-secret-with-32-chars",
      }),
    ).toMatchObject({
      DATABASE_URL: "postgresql://mindmap:mindmap@localhost:5432/mindmap",
    });
  });

  it("rejects a short session secret", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost/mindmap",
        SESSION_SECRET: "too-short",
      }),
    ).toThrow();
  });

  it("allows database-only consumers to validate without auth configuration", () => {
    expect(
      parseDatabaseEnv({ DATABASE_URL: "postgresql://localhost/mindmap" }),
    ).toEqual({ DATABASE_URL: "postgresql://localhost/mindmap" });
  });

  it("requires OAuth client IDs and secrets in pairs", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost/mindmap",
        SESSION_SECRET: "a-secure-session-secret-with-32-chars",
        GOOGLE_CLIENT_ID: "google-client",
      }),
    ).toThrow(/configured together/);
  });
});
