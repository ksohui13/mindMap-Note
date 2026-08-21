import { describe, expect, it } from "vitest";

import { createMindmapWithRoot } from "@/server/domain/mindmap.service";
import { countDescendants } from "@/server/domain/node.repository";
import {
  createChildNode,
  deleteNodeSubtree,
  updateNode,
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
