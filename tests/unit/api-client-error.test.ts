import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNodeContent } from "@/features/mindmap/api/client";

describe("API client errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a safe conflict revision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "CONFLICT",
        message: "stale",
        details: { currentRevision: 7 },
      },
    }), { status: 409, headers: { "content-type": "application/json" } })));

    await expect(fetchNodeContent("node-a")).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
      details: { currentRevision: 7 },
    });
  });

  it("drops malformed conflict details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "CONFLICT",
        message: "stale",
        details: { currentRevision: "unsafe" },
      },
    }), { status: 409, headers: { "content-type": "application/json" } })));

    await expect(fetchNodeContent("node-a")).rejects.toMatchObject({
      code: "CONFLICT",
      details: undefined,
    });
  });
});
