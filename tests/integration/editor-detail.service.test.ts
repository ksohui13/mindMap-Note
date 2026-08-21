import { describe, expect, it } from "vitest";

import {
  createMindmapWithRoot,
  getMindmapDetailForUser,
} from "@/server/domain/mindmap.service";
import { createChildNode, updateNode } from "@/server/domain/node.service";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

async function createTestUser(email: string) {
  return createUser({ email, passwordHash: "disabled" }, integrationClient);
}

describe("mindmap editor detail service", () => {
  it("returns an owned tree with positions, parents, and revisions", async () => {
    const user = await createTestUser("editor-detail@example.test");
    const created = await createMindmapWithRoot(user.id, integrationClient);
    const child = await createChildNode({
      mindmapId: created.mindmap.id,
      parentNodeId: created.rootNode.id,
      title: "Child",
      x: 240,
      y: 90,
    }, integrationClient);
    await updateNode(child.id, { x: 260, y: 110 }, integrationClient);

    const detail = await getMindmapDetailForUser(created.mindmap.id, user.id, integrationClient);
    expect(detail.rootNodeId).toBe(created.rootNode.id);
    expect(detail.nodes).toHaveLength(2);
    expect(detail.nodes.find((node) => node.id === child.id)).toMatchObject({
      parentNodeId: created.rootNode.id,
      x: 260,
      y: 110,
      revision: 1,
    });
  });

  it("uses the same not-found result for another user's mindmap", async () => {
    const [owner, stranger] = await Promise.all([
      createTestUser("editor-owner@example.test"),
      createTestUser("editor-stranger@example.test"),
    ]);
    const created = await createMindmapWithRoot(owner.id, integrationClient);

    await expect(
      getMindmapDetailForUser(created.mindmap.id, stranger.id, integrationClient),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects an empty mindmap and a parent from another mindmap", async () => {
    const user = await createTestUser("editor-integrity@example.test");
    const empty = await integrationClient.mindmap.create({
      data: { userId: user.id, sequenceNo: 1, title: "Empty" },
    });
    await expect(
      getMindmapDetailForUser(empty.id, user.id, integrationClient),
    ).rejects.toMatchObject({ code: "DATA_INTEGRITY" });

    const first = await createMindmapWithRoot(user.id, integrationClient);
    const second = await createMindmapWithRoot(user.id, integrationClient);
    await integrationClient.node.create({
      data: {
        mindmapId: first.mindmap.id,
        parentNodeId: second.rootNode.id,
        title: "Cross-map child",
      },
    });
    await expect(
      getMindmapDetailForUser(first.mindmap.id, user.id, integrationClient),
    ).rejects.toMatchObject({ code: "DATA_INTEGRITY" });
  });
});
