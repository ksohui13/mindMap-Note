import { describe, expect, it } from "vitest";

import { assertSameOrigin, readJsonBody } from "@/server/http/api";

describe("API request security", () => {
  it("accepts same-origin mutation requests", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { host: "localhost", origin: "http://localhost" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects missing and cross-site origins", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost/api/auth/login", { headers: { host: "localhost" } }),
      ),
    ).toThrowError(/출처/);
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost/api/auth/login", {
          headers: { host: "localhost", origin: "https://evil.example" },
        }),
      ),
    ).toThrowError(/출처/);
  });

  it("parses small JSON and rejects oversized bodies", async () => {
    await expect(
      readJsonBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        }),
      ),
    ).resolves.toEqual({ ok: true });

    await expect(
      readJsonBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: "x".repeat(17_000) }),
        }),
      ),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});
