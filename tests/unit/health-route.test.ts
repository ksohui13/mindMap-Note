import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns a healthy JSON response", async () => {
    const response = GET();
    const body = (await response.json()) as { service: string; status: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ service: "mindmap-mvp", status: "ok" });
  });
});
