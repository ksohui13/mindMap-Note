import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH as patchCollapse } from "@/app/api/nodes/[nodeId]/collapse/route";
import { PATCH as patchPosition } from "@/app/api/nodes/[nodeId]/position/route";
import { requireApiUser } from "@/server/auth/request";
import { DomainError } from "@/server/domain/errors";
import {
  updateNodeCollapseForUser,
  updateNodePositionForUser,
} from "@/server/domain/node.service";

vi.mock("@/server/auth/request", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/domain/node.service", () => ({
  updateNodeCollapseForUser: vi.fn(),
  updateNodePositionForUser: vi.fn(),
}));

const userId = "b229d752-18d2-4086-bc9c-d338a6406fd3";
const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const nodeId = "7d8828dc-d9d1-49ea-89d1-ec04925238a8";
const timestamp = new Date("2026-08-21T00:00:00.000Z");
const nodeRecord = {
  id: nodeId,
  mindmapId,
  parentNodeId: null,
  title: "Root",
  contentMd: "",
  x: 10,
  y: 20,
  isCollapsed: false,
  revision: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const context = { params: Promise.resolve({ nodeId }) };

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
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
  vi.mocked(updateNodePositionForUser).mockReset();
  vi.mocked(updateNodeCollapseForUser).mockReset();
  vi.mocked(requireApiUser).mockResolvedValue({ id: userId, email: "user@example.test" });
});

describe("node position route", () => {
  it("updates finite coordinates with revision", async () => {
    vi.mocked(updateNodePositionForUser).mockResolvedValue({
      ...nodeRecord,
      x: 120,
      y: -30,
      revision: 1,
    });
    const response = await patchPosition(
      request(`/api/nodes/${nodeId}/position`, { x: 120, y: -30, revision: 0 }),
      context,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      node: { id: nodeId, x: 120, y: -30, revision: 1 },
    });
    expect(updateNodePositionForUser).toHaveBeenCalledWith(nodeId, userId, 120, -30, 0);
  });

  it("rejects invalid coordinates and stale revisions", async () => {
    const invalid = await patchPosition(
      request(`/api/nodes/${nodeId}/position`, { x: "Infinity", y: 0, revision: 0 }),
      context,
    );
    expect(invalid.status).toBe(400);

    vi.mocked(updateNodePositionForUser).mockRejectedValue(
      new DomainError("CONFLICT", "stale"),
    );
    const conflict = await patchPosition(
      request(`/api/nodes/${nodeId}/position`, { x: 1, y: 2, revision: 0 }),
      context,
    );
    expect(conflict.status).toBe(409);
  });
});

describe("node collapse route", () => {
  it("updates a boolean collapse state with revision", async () => {
    vi.mocked(updateNodeCollapseForUser).mockResolvedValue({
      ...nodeRecord,
      isCollapsed: true,
      revision: 1,
    });
    const response = await patchCollapse(
      request(`/api/nodes/${nodeId}/collapse`, { isCollapsed: true, revision: 0 }),
      context,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      node: { id: nodeId, isCollapsed: true, revision: 1 },
    });
    expect(updateNodeCollapseForUser).toHaveBeenCalledWith(nodeId, userId, true, 0);
  });

  it("rejects non-boolean state and hides foreign nodes behind 404", async () => {
    const invalid = await patchCollapse(
      request(`/api/nodes/${nodeId}/collapse`, { isCollapsed: "true", revision: 0 }),
      context,
    );
    expect(invalid.status).toBe(400);

    vi.mocked(updateNodeCollapseForUser).mockRejectedValue(
      new DomainError("NOT_FOUND", "Node was not found."),
    );
    const missing = await patchCollapse(
      request(`/api/nodes/${nodeId}/collapse`, { isCollapsed: true, revision: 0 }),
      context,
    );
    expect(missing.status).toBe(404);
  });
});
