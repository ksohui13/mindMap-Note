import { describe, expect, it } from "vitest";

import {
  createMindmapWithRoot,
  listMindmapsWithNodeCount,
  updateMindmapTitle,
} from "@/server/domain/mindmap.service";
import { createChildNode } from "@/server/domain/node.service";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

async function createTestUser(email: string) {
  return createUser({ email, passwordHash: "disabled" }, integrationClient);
}

describe("dashboard mindmap services", () => {
  it("isolates each user's recent list and returns real node counts", async () => {
    const [userA, userB] = await Promise.all([
      createTestUser("dashboard-a@example.test"),
      createTestUser("dashboard-b@example.test"),
    ]);
    const older = await createMindmapWithRoot(userA.id, integrationClient);
    const newer = await createMindmapWithRoot(userA.id, integrationClient);
    await createMindmapWithRoot(userB.id, integrationClient);
    await createChildNode({
      mindmapId: newer.mindmap.id,
      parentNodeId: newer.rootNode.id,
      title: "Child",
      x: 100,
      y: 0,
    }, integrationClient);

    const list = await listMindmapsWithNodeCount(userA.id, integrationClient);
    expect(list.map((item) => item.id)).toEqual([newer.mindmap.id, older.mindmap.id]);
    expect(list.map((item) => item._count.nodes)).toEqual([2, 1]);
  });

  it("updates an owned title and updatedAt, but hides another user's resource", async () => {
    const [owner, stranger] = await Promise.all([
      createTestUser("dashboard-owner@example.test"),
      createTestUser("dashboard-stranger@example.test"),
    ]);
    const created = await createMindmapWithRoot(owner.id, integrationClient);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const renamed = await updateMindmapTitle(
      created.mindmap.id,
      owner.id,
      "  정리된 이름  ",
      integrationClient,
    );
    expect(renamed.title).toBe("정리된 이름");
    expect(renamed.updatedAt.getTime()).toBeGreaterThan(created.mindmap.updatedAt.getTime());

    await expect(
      updateMindmapTitle(created.mindmap.id, stranger.id, "침범", integrationClient),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
