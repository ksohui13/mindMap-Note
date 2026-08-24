import { describe, expect, it } from "vitest";

import { exportMindmapForUser } from "@/server/domain/mindmap-export.service";
import { createMindmapWithRoot } from "@/server/domain/mindmap.service";
import { createChildNode } from "@/server/domain/node.service";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

async function createTestUser(email: string) {
  return createUser({ email, passwordHash: "disabled" }, integrationClient);
}

describe("mindmap export service", () => {
  it("exports ALL, NODE, and SUBTREE from one repeatable-read snapshot", async () => {
    const owner = await createTestUser("export-owner@example.test");
    const created = await createMindmapWithRoot(owner.id, integrationClient);
    const child = await createChildNode({
      mindmapId: created.mindmap.id,
      parentNodeId: created.rootNode.id,
      title: "Child",
      x: 0,
      y: 0,
    }, integrationClient);
    const grandchild = await createChildNode({
      mindmapId: created.mindmap.id,
      parentNodeId: child.id,
      title: "Grandchild",
      x: 0,
      y: 0,
    }, integrationClient);
    const sibling = await createChildNode({
      mindmapId: created.mindmap.id,
      parentNodeId: created.rootNode.id,
      title: "Sibling",
      x: 0,
      y: 0,
    }, integrationClient);
    await Promise.all([
      integrationClient.node.update({ where: { id: child.id }, data: { contentMd: "# child body" } }),
      integrationClient.node.update({ where: { id: grandchild.id }, data: { contentMd: "grandchild body" } }),
    ]);

    const all = await exportMindmapForUser(
      created.mindmap.id,
      owner.id,
      { scope: "ALL", format: "MARKDOWN" },
      integrationClient,
    );
    expect(all.markdown).toContain("# child body");
    expect(all.markdown).toContain("Sibling");

    const node = await exportMindmapForUser(
      created.mindmap.id,
      owner.id,
      { scope: "NODE", nodeId: child.id, format: "MARKDOWN" },
      integrationClient,
    );
    expect(node.markdown).toContain("Root › Child");
    expect(node.markdown).not.toContain("Grandchild");
    expect(node.markdown).not.toContain("Sibling");

    const subtree = await exportMindmapForUser(
      created.mindmap.id,
      owner.id,
      { scope: "SUBTREE", nodeId: child.id, format: "MARKDOWN" },
      integrationClient,
    );
    expect(subtree.markdown).toContain("Grandchild");
    expect(subtree.markdown).toContain("Root › Child › Grandchild");
    expect(subtree.markdown).not.toContain("Sibling");
    expect(subtree.markdown.indexOf("Child")).toBeLessThan(subtree.markdown.indexOf("Grandchild"));
    expect(sibling.id).not.toBe(child.id);
  });

  it("hides another user's mindmap and a node from a different mindmap", async () => {
    const [owner, stranger] = await Promise.all([
      createTestUser("export-visibility-owner@example.test"),
      createTestUser("export-visibility-stranger@example.test"),
    ]);
    const [first, second] = await Promise.all([
      createMindmapWithRoot(owner.id, integrationClient),
      createMindmapWithRoot(owner.id, integrationClient),
    ]);

    await expect(exportMindmapForUser(
      first.mindmap.id,
      stranger.id,
      { scope: "ALL", format: "MARKDOWN" },
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(exportMindmapForUser(
      first.mindmap.id,
      owner.id,
      { scope: "NODE", nodeId: second.rootNode.id, format: "MARKDOWN" },
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
