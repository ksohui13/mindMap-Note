import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mindmaps/[mindmapId]/export/route";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import { exportMindmapForUser } from "@/server/domain/mindmap-export.service";
import { ApiError } from "@/server/http/api";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/mindmap-export.service", () => ({ exportMindmapForUser: vi.fn() }));

const userId = "b229d752-18d2-4086-bc9c-d338a6406fd3";
const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const nodeId = "7d8828dc-d9d1-49ea-89d1-ec04925238a8";

function request(body: unknown, origin = "http://localhost") {
  return new NextRequest(`http://localhost/api/mindmaps/${mindmapId}/export`, {
    method: "POST",
    headers: { host: "localhost", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireApiUser).mockReset();
  vi.mocked(exportMindmapForUser).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("mindmap export route", () => {
  const context = { params: Promise.resolve({ mindmapId }) };

  it("returns raw UTF-8 Markdown with download security headers", async () => {
    vi.mocked(exportMindmapForUser).mockResolvedValue({
      markdown: "# 한글\n",
      filename: "한글-all.md",
      contentDisposition: "attachment; filename=\"mindmap-export.md\"; filename*=UTF-8''encoded",
    });
    const response = await POST(request({ scope: "ALL", format: "MARKDOWN" }), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''encoded");
    await expect(response.text()).resolves.toBe("# 한글\n");
    expect(exportMindmapForUser).toHaveBeenCalledWith(
      mindmapId,
      userId,
      { scope: "ALL", format: "MARKDOWN" },
    );
  });

  it("strictly validates scope and node combinations", async () => {
    const invalidBodies = [
      { scope: "ALL", nodeId, format: "MARKDOWN" },
      { scope: "NODE", format: "MARKDOWN" },
      { scope: "SUBTREE", nodeId: "invalid", format: "MARKDOWN" },
      { scope: "NODE", nodeId, format: "PDF" },
      { scope: "ALL", format: "MARKDOWN", extra: true },
    ];
    for (const body of invalidBodies) {
      const response = await POST(request(body), context);
      expect(response.status).toBe(400);
    }
    expect(exportMindmapForUser).not.toHaveBeenCalled();
  });

  it("enforces same-origin, authentication, and ownership", async () => {
    expect((await POST(request({ scope: "ALL", format: "MARKDOWN" }, "https://evil.test"), context)).status)
      .toBe(403);

    vi.mocked(requireApiUser).mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "Authentication required."),
    );
    expect((await POST(request({ scope: "ALL", format: "MARKDOWN" }), context)).status).toBe(401);

    vi.mocked(exportMindmapForUser).mockRejectedValueOnce(
      new DomainError("NOT_FOUND", "Mindmap was not found."),
    );
    expect((await POST(request({ scope: "NODE", nodeId, format: "MARKDOWN" }), context)).status)
      .toBe(404);
  });
});
