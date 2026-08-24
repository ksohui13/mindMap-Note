import { describe, expect, it } from "vitest";

import { createMindmapWithRoot } from "@/server/domain/mindmap.service";
import { countDescendants } from "@/server/domain/node.repository";
import {
  createChildNode,
  createChildNodeForUser,
  deleteNodeSubtree,
  getNodeContentForUser,
  updateNode,
  updateNodeCollapseForUser,
  updateNodeContentForUser,
  updateNodePositionForUser,
  updateNodeTitleForUser,
} from "@/server/domain/node.service";
import { createSession } from "@/server/domain/session.repository";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

async function createTreeOwner(email: string) {
  const user = await createUser({ email, passwordHash: "disabled" }, integrationClient);
  const created = await createMindmapWithRoot(user.id, integrationClient);
  return { user, ...created };
}

describe("node domain services", () => {
  it("creates an owned child and rejects foreign ownership or a cross-map parent", async () => {
    const owner = await createTreeOwner("owned-child@example.test");
    const otherMap = await createMindmapWithRoot(owner.user.id, integrationClient);
    const stranger = await createTreeOwner("foreign-child@example.test");

    await expect(createChildNodeForUser({
      mindmapId: owner.mindmap.id,
      parentNodeId: owner.rootNode.id,
      title: " 새 노드 ",
      x: 240,
      y: 0,
    }, owner.user.id, integrationClient)).resolves.toMatchObject({
      node: { title: "새 노드", parentNodeId: owner.rootNode.id },
    });

    await expect(createChildNodeForUser({
      mindmapId: owner.mindmap.id,
      parentNodeId: otherMap.rootNode.id,
      title: "잘못된 부모",
      x: 0,
      y: 0,
    }, owner.user.id, integrationClient)).rejects.toMatchObject({ code: "DATA_INTEGRITY" });

    await expect(createChildNodeForUser({
      mindmapId: owner.mindmap.id,
      parentNodeId: owner.rootNode.id,
      title: "비소유",
      x: 0,
      y: 0,
    }, stranger.user.id, integrationClient)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates a title only for its owner and matching revision", async () => {
    const owner = await createTreeOwner("revision-owner@example.test");
    const stranger = await createTreeOwner("revision-stranger@example.test");

    const updated = await updateNodeTitleForUser(
      owner.rootNode.id,
      owner.user.id,
      "새 루트",
      0,
      integrationClient,
    );
    expect(updated).toMatchObject({ title: "새 루트", revision: 1 });

    await expect(updateNodeTitleForUser(
      owner.rootNode.id,
      owner.user.id,
      "오래된 수정",
      0,
      integrationClient,
    )).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateNodeTitleForUser(
      owner.rootNode.id,
      stranger.user.id,
      "비소유 수정",
      1,
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("persists owned position and collapse changes without changing the parent", async () => {
    const owner = await createTreeOwner("node-state-owner@example.test");
    const stranger = await createTreeOwner("node-state-stranger@example.test");
    const child = await createChildNode({
      mindmapId: owner.mindmap.id,
      parentNodeId: owner.rootNode.id,
      title: "Movable",
      x: 1,
      y: 2,
    }, integrationClient);

    const moved = await updateNodePositionForUser(
      child.id,
      owner.user.id,
      450,
      -120,
      0,
      integrationClient,
    );
    expect(moved).toMatchObject({
      parentNodeId: owner.rootNode.id,
      x: 450,
      y: -120,
      revision: 1,
    });

    const collapsed = await updateNodeCollapseForUser(
      child.id,
      owner.user.id,
      true,
      1,
      integrationClient,
    );
    expect(collapsed).toMatchObject({
      parentNodeId: owner.rootNode.id,
      isCollapsed: true,
      revision: 2,
    });

    await expect(updateNodePositionForUser(
      child.id,
      owner.user.id,
      0,
      0,
      1,
      integrationClient,
    )).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateNodeCollapseForUser(
      child.id,
      stranger.user.id,
      false,
      2,
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reads and updates Markdown only for its owner and matching revision", async () => {
    const owner = await createTreeOwner("content-owner@example.test");
    const stranger = await createTreeOwner("content-stranger@example.test");
    const oldTimestamp = new Date("2000-01-01T00:00:00.000Z");
    await integrationClient.mindmap.update({
      where: { id: owner.mindmap.id },
      data: { updatedAt: oldTimestamp },
    });

    await expect(getNodeContentForUser(
      owner.rootNode.id,
      owner.user.id,
      integrationClient,
    )).resolves.toMatchObject({ contentMd: "", revision: 0 });
    await expect(getNodeContentForUser(
      owner.rootNode.id,
      stranger.user.id,
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });

    const updated = await updateNodeContentForUser(
      owner.rootNode.id,
      owner.user.id,
      "# 상세",
      0,
      integrationClient,
    );
    expect(updated).toMatchObject({ contentMd: "# 상세", revision: 1 });
    await expect(updateNodeContentForUser(
      owner.rootNode.id,
      owner.user.id,
      "오래된 저장",
      0,
      integrationClient,
    )).rejects.toMatchObject({ code: "CONFLICT" });

    const mindmap = await integrationClient.mindmap.findUniqueOrThrow({
      where: { id: owner.mindmap.id },
    });
    expect(mindmap.updatedAt.getTime()).toBeGreaterThan(oldTimestamp.getTime());
  });

  it("rejects a parent from another mindmap", async () => {
    const owner = await createTreeOwner("parent@example.test");
    const other = await createMindmapWithRoot(owner.user.id, integrationClient);

    await expect(
      createChildNode(
        {
          mindmapId: other.mindmap.id,
          parentNodeId: owner.rootNode.id,
          title: "Invalid child",
          x: 10,
          y: 20,
        },
        integrationClient,
      ),
    ).rejects.toMatchObject({ code: "DATA_INTEGRITY" });
  });

  it("protects the root and deletes only the selected subtree", async () => {
    const owner = await createTreeOwner("subtree@example.test");
    const child = await createChildNode(
      {
        mindmapId: owner.mindmap.id,
        parentNodeId: owner.rootNode.id,
        title: "Child",
        x: 1,
        y: 1,
      },
      integrationClient,
    );
    await createChildNode(
      {
        mindmapId: owner.mindmap.id,
        parentNodeId: child.id,
        title: "Grandchild",
        x: 2,
        y: 2,
      },
      integrationClient,
    );
    const sibling = await createChildNode(
      {
        mindmapId: owner.mindmap.id,
        parentNodeId: owner.rootNode.id,
        title: "Sibling",
        x: 3,
        y: 3,
      },
      integrationClient,
    );

    expect(await countDescendants(child.id, integrationClient)).toBe(1);
    await expect(deleteNodeSubtree(owner.rootNode.id, integrationClient)).rejects.toMatchObject({
      code: "ROOT_DELETE_FORBIDDEN",
    });
    await expect(deleteNodeSubtree(child.id, integrationClient)).resolves.toEqual({
      deletedCount: 2,
    });
    expect(await integrationClient.node.findUnique({ where: { id: sibling.id } })).not.toBeNull();
  });

  it("touches the mindmap when a node changes", async () => {
    const owner = await createTreeOwner("touch@example.test");
    const oldTimestamp = new Date("2000-01-01T00:00:00.000Z");
    await integrationClient.mindmap.update({
      where: { id: owner.mindmap.id },
      data: { updatedAt: oldTimestamp },
    });

    const updated = await updateNode(
      owner.rootNode.id,
      {
        title: "새 루트",
        contentMd: "# 상세",
        x: 12,
        y: 34,
        isCollapsed: true,
      },
      integrationClient,
    );
    const mindmap = await integrationClient.mindmap.findUniqueOrThrow({
      where: { id: owner.mindmap.id },
    });

    expect(updated).toMatchObject({
      title: "새 루트",
      contentMd: "# 상세",
      x: 12,
      y: 34,
      isCollapsed: true,
      revision: 1,
    });
    expect(mindmap.updatedAt.getTime()).toBeGreaterThan(oldTimestamp.getTime());
  });

  it("cascades user, session, mindmap, and node relationships", async () => {
    const owner = await createTreeOwner("cascade@example.test");
    await createSession(
      {
        userId: owner.user.id,
        tokenHash: "b".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
      integrationClient,
    );
    await createChildNode(
      {
        mindmapId: owner.mindmap.id,
        parentNodeId: owner.rootNode.id,
        title: "Child",
        x: 1,
        y: 1,
      },
      integrationClient,
    );

    await integrationClient.user.delete({ where: { id: owner.user.id } });

    expect(await integrationClient.session.count()).toBe(0);
    expect(await integrationClient.mindmap.count()).toBe(0);
    expect(await integrationClient.node.count()).toBe(0);
  });
});
