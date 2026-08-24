import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/mindmaps/[mindmapId]/nodes/route";
import { GET as getDeletionImpact } from "@/app/api/nodes/[nodeId]/deletion-impact/route";
import { DELETE, PATCH } from "@/app/api/nodes/[nodeId]/route";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import { ApiError } from "@/server/http/api";
import {
  createChildNodeForUser,
  deleteNodeSubtreeForUser,
  getNodeDeletionImpactForUser,
  updateNodeTitleForUser,
} from "@/server/domain/node.service";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/node.service", () => ({
  createChildNodeForUser: vi.fn(),
  deleteNodeSubtreeForUser: vi.fn(),
  getNodeDeletionImpactForUser: vi.fn(),
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

function request(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireApiUser).mockReset();
  vi.mocked(createChildNodeForUser).mockReset();
  vi.mocked(deleteNodeSubtreeForUser).mockReset();
  vi.mocked(getNodeDeletionImpactForUser).mockReset();
  vi.mocked(updateNodeTitleForUser).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("node deletion routes", () => {
  const context = { params: Promise.resolve({ nodeId }) };

  it("returns the current subtree impact", async () => {
    vi.mocked(getNodeDeletionImpactForUser).mockResolvedValue({
      node: { id: nodeId, title: "삭제할 노드" },
      descendantCount: 3,
      totalDeleteCount: 4,
    });

    const response = await getDeletionImpact(
      request(`/api/nodes/${nodeId}/deletion-impact`, "GET"),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      node: { id: nodeId, title: "삭제할 노드" },
      descendantCount: 3,
      totalDeleteCount: 4,
    });
    expect(getNodeDeletionImpactForUser).toHaveBeenCalledWith(nodeId, userId);
  });

  it("hides foreign impact and rejects root impact", async () => {
    vi.mocked(getNodeDeletionImpactForUser).mockRejectedValueOnce(
      new DomainError("NOT_FOUND", "Node was not found."),
    );
    const missing = await getDeletionImpact(
      request(`/api/nodes/${nodeId}/deletion-impact`, "GET"),
      context,
    );
    expect(missing.status).toBe(404);

    vi.mocked(getNodeDeletionImpactForUser).mockRejectedValueOnce(
      new DomainError("ROOT_DELETE_FORBIDDEN", "Root node cannot be deleted."),
    );
    const root = await getDeletionImpact(
      request(`/api/nodes/${nodeId}/deletion-impact`, "GET"),
      context,
    );
    expect(root.status).toBe(409);
    await expect(root.json()).resolves.toMatchObject({ error: { code: "ROOT_DELETE_FORBIDDEN" } });
  });

  it("deletes only after validating the expected subtree count", async () => {
    vi.mocked(deleteNodeSubtreeForUser).mockResolvedValue({
      deletedNodeId: nodeId,
      deletedCount: 4,
      mindmapUpdatedAt: updatedAt,
    });

    const response = await DELETE(
      request(`/api/nodes/${nodeId}`, "DELETE", { expectedDeleteCount: 4 }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedNodeId: nodeId,
      deletedCount: 4,
      mindmapUpdatedAt: updatedAt.toISOString(),
    });
    expect(deleteNodeSubtreeForUser).toHaveBeenCalledWith(nodeId, userId, 4);
  });

  it("rejects invalid input and exposes safe root/stale/not-found envelopes", async () => {
    const invalid = await DELETE(
      request(`/api/nodes/${nodeId}`, "DELETE", { expectedDeleteCount: 0 }),
      context,
    );
    expect(invalid.status).toBe(400);
    expect(deleteNodeSubtreeForUser).not.toHaveBeenCalled();

    for (const [code, status] of [["CONFLICT", 409], ["NOT_FOUND", 404]] as const) {
      vi.mocked(deleteNodeSubtreeForUser).mockRejectedValueOnce(
        new DomainError(code, code === "CONFLICT" ? "Delete scope changed." : "Node was not found."),
      );
      const response = await DELETE(
        request(`/api/nodes/${nodeId}`, "DELETE", { expectedDeleteCount: 1 }),
        context,
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ error: { code } });
    }
  });

  it("rejects an invalid node ID before impact or deletion service calls", async () => {
    const invalidContext = { params: Promise.resolve({ nodeId: "not-a-uuid" }) };
    const impact = await getDeletionImpact(
      request("/api/nodes/not-a-uuid/deletion-impact", "GET"),
      invalidContext,
    );
    const deletion = await DELETE(
      request("/api/nodes/not-a-uuid", "DELETE", { expectedDeleteCount: 1 }),
      invalidContext,
    );

    expect(impact.status).toBe(400);
    expect(deletion.status).toBe(400);
    expect(getNodeDeletionImpactForUser).not.toHaveBeenCalled();
    expect(deleteNodeSubtreeForUser).not.toHaveBeenCalled();
  });

  it("rejects cross-origin deletion before calling the service", async () => {
    const response = await DELETE(new NextRequest(`http://localhost/api/nodes/${nodeId}`, {
      method: "DELETE",
      headers: { host: "localhost", origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ expectedDeleteCount: 1 }),
    }), context);

    expect(response.status).toBe(403);
    expect(deleteNodeSubtreeForUser).not.toHaveBeenCalled();
  });

  it("requires an authenticated database session for deletion", async () => {
    vi.mocked(requireApiUser).mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "Authentication required."),
    );
    const response = await DELETE(
      request(`/api/nodes/${nodeId}`, "DELETE", { expectedDeleteCount: 1 }),
      context,
    );
    expect(response.status).toBe(401);
    expect(deleteNodeSubtreeForUser).not.toHaveBeenCalled();
  });
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
