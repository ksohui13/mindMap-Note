import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mindmaps/[mindmapId]/nodes/route";
import { PATCH } from "@/app/api/nodes/[nodeId]/route";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import {
  createChildNodeForUser,
  updateNodeTitleForUser,
} from "@/server/domain/node.service";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/node.service", () => ({
  createChildNodeForUser: vi.fn(),
  updateNodeTitleForUser: vi.fn(),
}));

const userId = "b229d752-18d2-4086-bc9c-d338a6406fd3";
const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const parentNodeId = "197c9309-bb27-4d11-8071-c99b8728fc7b";
const nodeId = "7d8828dc-d9d1-49ea-89d1-ec04925238a8";
const updatedAt = new Date("2026-08-21T00:00:00.000Z");
const nodeRecord = {
  id: nodeId,
  mindmapId,
  parentNodeId,
  title: "새 노드",
  contentMd: "",
  x: 240,
  y: 0,
  isCollapsed: false,
  revision: 0,
  createdAt: updatedAt,
  updatedAt,
};

function request(path: string, method: "POST" | "PATCH", body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireApiUser).mockReset();
  vi.mocked(createChildNodeForUser).mockReset();
  vi.mocked(updateNodeTitleForUser).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("node creation route", () => {
  const context = { params: Promise.resolve({ mindmapId }) };

  it("creates an owned child and returns a minimal DTO", async () => {
    vi.mocked(createChildNodeForUser).mockResolvedValue({
      node: nodeRecord,
      mindmapUpdatedAt: updatedAt,
    });
    const response = await POST(request(`/api/mindmaps/${mindmapId}/nodes`, "POST", {
      parentNodeId,
      title: " 새 노드 ",
      x: 240,
      y: 0,
    }), context);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      node: {
        id: nodeId,
        parentNodeId,
        title: "새 노드",
        x: 240,
        y: 0,
        isCollapsed: false,
        revision: 0,
      },
      mindmapUpdatedAt: updatedAt.toISOString(),
    });
    expect(createChildNodeForUser).toHaveBeenCalledWith({
      mindmapId,
      parentNodeId,
      title: "새 노드",
      x: 240,
      y: 0,
    }, userId);
  });

  it("rejects blank titles and non-finite coordinates", async () => {
    const blank = await POST(request(`/api/mindmaps/${mindmapId}/nodes`, "POST", {
      parentNodeId,
      title: "   ",
      x: 0,
      y: 0,
    }), context);
    const nonFinite = await POST(request(`/api/mindmaps/${mindmapId}/nodes`, "POST", {
      parentNodeId,
      title: "child",
      x: "Infinity",
      y: 0,
    }), context);

    expect(blank.status).toBe(400);
    expect(nonFinite.status).toBe(400);
    expect(createChildNodeForUser).not.toHaveBeenCalled();
  });

  it("does not expose a missing or foreign mindmap", async () => {
    vi.mocked(createChildNodeForUser).mockRejectedValue(
      new DomainError("NOT_FOUND", "Mindmap was not found."),
    );
    const response = await POST(request(`/api/mindmaps/${mindmapId}/nodes`, "POST", {
      parentNodeId,
      title: "child",
      x: 0,
      y: 0,
    }), context);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});

describe("node title route", () => {
  const context = { params: Promise.resolve({ nodeId }) };

  it("updates a title with the expected revision", async () => {
    vi.mocked(updateNodeTitleForUser).mockResolvedValue({
      ...nodeRecord,
      title: "변경된 제목",
      revision: 1,
    });
    const response = await PATCH(request(`/api/nodes/${nodeId}`, "PATCH", {
      title: " 변경된 제목 ",
      revision: 0,
    }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      node: { id: nodeId, title: "변경된 제목", revision: 1 },
    });
    expect(updateNodeTitleForUser).toHaveBeenCalledWith(nodeId, userId, "변경된 제목", 0);
  });

  it("returns 409 for a stale revision and 404 for a foreign node", async () => {
    vi.mocked(updateNodeTitleForUser).mockRejectedValueOnce(
      new DomainError("CONFLICT", "Node was changed by another request.", undefined, {
        currentRevision: 4,
      }),
    );
    const conflict = await PATCH(request(`/api/nodes/${nodeId}`, "PATCH", {
      title: "제목",
      revision: 0,
    }), context);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: "CONFLICT", details: { currentRevision: 4 } },
    });

    vi.mocked(updateNodeTitleForUser).mockRejectedValueOnce(
      new DomainError("NOT_FOUND", "Node was not found."),
    );
    const missing = await PATCH(request(`/api/nodes/${nodeId}`, "PATCH", {
      title: "제목",
      revision: 1,
    }), context);
    expect(missing.status).toBe(404);
  });
});
