import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/nodes/[nodeId]/content/route";
import { NODE_CONTENT_MAX_BYTES } from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import {
  getNodeContentForUser,
  updateNodeContentForUser,
} from "@/server/domain/node.service";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/node.service", () => ({
  getNodeContentForUser: vi.fn(),
  updateNodeContentForUser: vi.fn(),
}));

const userId = "b229d752-18d2-4086-bc9c-d338a6406fd3";
const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const nodeId = "7d8828dc-d9d1-49ea-89d1-ec04925238a8";
const updatedAt = new Date("2026-08-24T00:00:00.000Z");
const nodeRecord = {
  id: nodeId,
  mindmapId,
  parentNodeId: null,
  title: "상세 노드",
  contentMd: "# 기존 내용",
  x: 0,
  y: 0,
  isCollapsed: false,
  revision: 2,
  createdAt: updatedAt,
  updatedAt,
};
const context = { params: Promise.resolve({ nodeId }) };

function request(method: "GET" | "PATCH", body?: unknown) {
  return new NextRequest(`http://localhost/api/nodes/${nodeId}/content`, {
    method,
    headers: body === undefined ? undefined : {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireApiUser).mockReset();
  vi.mocked(getNodeContentForUser).mockReset();
  vi.mocked(updateNodeContentForUser).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("node content route", () => {
  it("returns only the owned node content fields", async () => {
    vi.mocked(getNodeContentForUser).mockResolvedValue(nodeRecord);

    const response = await GET(request("GET"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      node: { id: nodeId, title: "상세 노드", contentMd: "# 기존 내용", revision: 2 },
    });
    expect(getNodeContentForUser).toHaveBeenCalledWith(nodeId, userId);
  });

  it("updates empty Markdown and preserves the expected revision", async () => {
    vi.mocked(updateNodeContentForUser).mockResolvedValue({
      ...nodeRecord,
      contentMd: "",
      revision: 3,
    });

    const response = await PATCH(request("PATCH", { contentMd: "", revision: 2 }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      node: { id: nodeId, contentMd: "", revision: 3 },
    });
    expect(updateNodeContentForUser).toHaveBeenCalledWith(nodeId, userId, "", 2);
  });

  it("accepts the 256KiB UTF-8 boundary and rejects larger content", async () => {
    const boundary = "a".repeat(NODE_CONTENT_MAX_BYTES);
    vi.mocked(updateNodeContentForUser).mockResolvedValue({
      ...nodeRecord,
      contentMd: boundary,
      revision: 3,
    });

    const accepted = await PATCH(request("PATCH", { contentMd: boundary, revision: 2 }), context);
    const rejected = await PATCH(request("PATCH", {
      contentMd: `${boundary}a`,
      revision: 2,
    }), context);

    expect(accepted.status).toBe(200);
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Markdown 내용은 UTF-8 기준 256KiB 이하여야 합니다.",
      },
    });
  });

  it("maps stale revisions to 409 and foreign nodes to 404", async () => {
    vi.mocked(updateNodeContentForUser).mockRejectedValueOnce(
      new DomainError("CONFLICT", "Node was changed by another request.", undefined, {
        currentRevision: 9,
      }),
    );
    const conflict = await PATCH(request("PATCH", { contentMd: "변경", revision: 1 }), context);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: "CONFLICT", details: { currentRevision: 9 } },
    });

    vi.mocked(getNodeContentForUser).mockRejectedValueOnce(
      new DomainError("NOT_FOUND", "Node was not found."),
    );
    const missing = await GET(request("GET"), context);
    expect(missing.status).toBe(404);
  });
});
