import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/mindmaps/route";
import { DELETE, GET as getMindmapRoute, PATCH } from "@/app/api/mindmaps/[mindmapId]/route";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import {
  createMindmapWithRoot,
  deleteMindmapForUser,
  getMindmapDetailForUser,
  listMindmapsWithNodeCount,
  updateMindmapTitle,
} from "@/server/domain/mindmap.service";
import { ApiError } from "@/server/http/api";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/mindmap.service", () => ({
  createMindmapWithRoot: vi.fn(),
  deleteMindmapForUser: vi.fn(),
  getMindmapDetailForUser: vi.fn(),
  listMindmapsWithNodeCount: vi.fn(),
  updateMindmapTitle: vi.fn(),
}));

const userId = "b229d752-18d2-4086-bc9c-d338a6406fd3";
const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const rootNodeId = "197c9309-bb27-4d11-8071-c99b8728fc7b";
const updatedAt = new Date("2026-08-19T03:00:00.000Z");
const mindmapRecord = {
  id: mindmapId,
  userId,
  title: "제품 아이디어",
  sequenceNo: 1,
  createdAt: new Date("2026-08-19T02:00:00.000Z"),
  updatedAt,
};

function request(path = "/api/mindmaps", method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireApiUser).mockReset();
  vi.mocked(createMindmapWithRoot).mockReset();
  vi.mocked(deleteMindmapForUser).mockReset();
  vi.mocked(getMindmapDetailForUser).mockReset();
  vi.mocked(listMindmapsWithNodeCount).mockReset();
  vi.mocked(updateMindmapTitle).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("mindmap collection route", () => {
  it("returns 401 without a valid database session", async () => {
    vi.mocked(requireApiUser).mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Authentication required."));
    const response = await GET(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns ordered summaries with real node counts", async () => {
    vi.mocked(listMindmapsWithNodeCount).mockResolvedValue([
      { ...mindmapRecord, _count: { nodes: 7 } },
    ]);
    const response = await GET(request());
    await expect(response.json()).resolves.toEqual({
      mindmaps: [{
        id: mindmapId,
        title: "제품 아이디어",
        sequenceNo: 1,
        updatedAt: updatedAt.toISOString(),
        nodeCount: 7,
      }],
    });
    expect(listMindmapsWithNodeCount).toHaveBeenCalledWith(userId);
  });

  it("returns both the created summary and root ID", async () => {
    vi.mocked(createMindmapWithRoot).mockResolvedValue({
      mindmap: mindmapRecord,
      rootNode: {
        id: rootNodeId,
        mindmapId,
        parentNodeId: null,
        title: "시작",
        contentMd: "",
        x: 0,
        y: 0,
        isCollapsed: false,
        revision: 0,
        createdAt: updatedAt,
        updatedAt,
      },
    });
    const response = await POST(request("/api/mindmaps", "POST", { mindmapId, rootNodeId }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      mindmap: { id: mindmapId, nodeCount: 1 },
      rootNodeId,
      detail: {
        mindmap: { id: mindmapId },
        rootNodeId,
        nodes: [{ id: rootNodeId }],
      },
    });
    expect(createMindmapWithRoot).toHaveBeenCalledWith(userId, { mindmapId, rootNodeId });
  });
});

describe("mindmap item route", () => {
  const context = { params: Promise.resolve({ mindmapId }) };

  it("returns a minimal owned detail DTO", async () => {
    vi.mocked(getMindmapDetailForUser).mockResolvedValue({
      id: mindmapId,
      title: "제품 아이디어",
      updatedAt,
      rootNodeId,
      nodes: [{
        id: rootNodeId,
        parentNodeId: null,
        title: "시작",
        x: 10,
        y: 20,
        isCollapsed: false,
        revision: 0,
      }],
    });
    const response = await getMindmapRoute(request(`/api/mindmaps/${mindmapId}`), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mindmap: { id: mindmapId, title: "제품 아이디어", updatedAt: updatedAt.toISOString() },
      rootNodeId,
      nodes: [{ id: rootNodeId, parentNodeId: null, title: "시작", x: 10, y: 20, isCollapsed: false, revision: 0 }],
    });
    expect(getMindmapDetailForUser).toHaveBeenCalledWith(mindmapId, userId);
  });

  it("rejects an invalid detail ID before querying the service", async () => {
    const response = await getMindmapRoute(
      request("/api/mindmaps/not-a-uuid"),
      { params: Promise.resolve({ mindmapId: "not-a-uuid" }) },
    );
    expect(response.status).toBe(400);
    expect(getMindmapDetailForUser).not.toHaveBeenCalled();
  });

  it("returns 409 for corrupt tree data", async () => {
    vi.mocked(getMindmapDetailForUser).mockRejectedValue(new DomainError("DATA_INTEGRITY", "corrupt"));
    const response = await getMindmapRoute(request(`/api/mindmaps/${mindmapId}`), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "DATA_INTEGRITY" } });
  });

  it("returns the same 404 for a missing or foreign detail", async () => {
    vi.mocked(getMindmapDetailForUser).mockRejectedValue(new DomainError("NOT_FOUND", "Mindmap was not found."));
    const response = await getMindmapRoute(request(`/api/mindmaps/${mindmapId}`), context);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns a generic 500 without exposing unexpected database errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getMindmapDetailForUser).mockRejectedValue(new Error("database password leaked"));
    const response = await getMindmapRoute(request(`/api/mindmaps/${mindmapId}`), context);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("database password leaked");
    errorLog.mockRestore();
  });

  it("validates trimmed titles", async () => {
    const response = await PATCH(request(`/api/mindmaps/${mindmapId}`, "PATCH", { title: "   " }), context);
    expect(response.status).toBe(400);
    expect(updateMindmapTitle).not.toHaveBeenCalled();
  });

  it("returns the same 404 envelope for missing or foreign resources", async () => {
    vi.mocked(updateMindmapTitle).mockRejectedValue(new DomainError("NOT_FOUND", "Mindmap was not found."));
    const response = await PATCH(request(`/api/mindmaps/${mindmapId}`, "PATCH", { title: "새 이름" }), context);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(updateMindmapTitle).toHaveBeenCalledWith(mindmapId, userId, "새 이름");
  });

  it("deletes an owned mindmap only when the node count still matches", async () => {
    vi.mocked(deleteMindmapForUser).mockResolvedValue({
      deletedMindmapId: mindmapId,
      deletedNodeCount: 7,
    });
    const response = await DELETE(
      request(`/api/mindmaps/${mindmapId}`, "DELETE", { expectedNodeCount: 7 }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedMindmapId: mindmapId,
      deletedNodeCount: 7,
    });
    expect(deleteMindmapForUser).toHaveBeenCalledWith(mindmapId, userId, 7);
  });

  it("rejects an invalid or stale mindmap deletion scope", async () => {
    const invalid = await DELETE(
      request(`/api/mindmaps/${mindmapId}`, "DELETE", { expectedNodeCount: -1 }),
      context,
    );
    expect(invalid.status).toBe(400);
    expect(deleteMindmapForUser).not.toHaveBeenCalled();

    vi.mocked(deleteMindmapForUser).mockRejectedValue(
      new DomainError("CONFLICT", "Delete scope changed."),
    );
    const stale = await DELETE(
      request(`/api/mindmaps/${mindmapId}`, "DELETE", { expectedNodeCount: 6 }),
      context,
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ error: { code: "CONFLICT" } });
  });
});
