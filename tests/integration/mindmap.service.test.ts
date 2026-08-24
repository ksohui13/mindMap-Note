import { describe, expect, it } from "vitest";

import { createMindmapWithRoot, deleteMindmapForUser } from "@/server/domain/mindmap.service";
import { createChildNode } from "@/server/domain/node.service";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

async function createTestUser(email: string) {
  return createUser({ email, passwordHash: "disabled" }, integrationClient);
}

describe("createMindmapWithRoot", () => {
  it("creates the numbered mindmap and root atomically", async () => {
    const user = await createTestUser("atomic@example.test");
    const created = await createMindmapWithRoot(user.id, integrationClient);

    expect(created.mindmap).toMatchObject({
      title: "새로운 마인드맵 1",
      sequenceNo: 1,
    });
    expect(created.rootNode).toMatchObject({ title: "시작", parentNodeId: null });
  });

  it("rolls back a transaction when the second root violates the partial index", async () => {
    const user = await createTestUser("rollback@example.test");

    await expect(
      integrationClient.$transaction(async (transaction) => {
        const mindmap = await transaction.mindmap.create({
          data: { userId: user.id, title: "Rollback", sequenceNo: 1 },
        });
        await transaction.node.create({
          data: { mindmapId: mindmap.id, title: "Root" },
        });
        await transaction.node.create({
          data: { mindmapId: mindmap.id, title: "Second root" },
        });
      }),
    ).rejects.toBeDefined();

    expect(await integrationClient.mindmap.count({ where: { userId: user.id } })).toBe(0);
  });

  it("reuses a deleted maximum sequence but does not fill middle gaps", async () => {
    const user = await createTestUser("sequence@example.test");
    const first = await createMindmapWithRoot(user.id, integrationClient);
    const second = await createMindmapWithRoot(user.id, integrationClient);
    const third = await createMindmapWithRoot(user.id, integrationClient);

    await deleteMindmapForUser(third.mindmap.id, user.id, 1, integrationClient);
    expect((await createMindmapWithRoot(user.id, integrationClient)).mindmap.sequenceNo).toBe(3);

    await deleteMindmapForUser(second.mindmap.id, user.id, 1, integrationClient);
    expect((await createMindmapWithRoot(user.id, integrationClient)).mindmap.sequenceNo).toBe(4);
    expect(first.mindmap.sequenceNo).toBe(1);
  });

  it("rejects stale or foreign deletion and cascades only after confirmation", async () => {
    const owner = await createTestUser("delete-owner@example.test");
    const stranger = await createTestUser("delete-stranger@example.test");
    const created = await createMindmapWithRoot(owner.id, integrationClient);
    await createChildNode({
      mindmapId: created.mindmap.id,
      parentNodeId: created.rootNode.id,
      title: "Child",
      x: 100,
      y: 100,
    }, integrationClient);

    await expect(deleteMindmapForUser(
      created.mindmap.id,
      stranger.id,
      2,
      integrationClient,
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteMindmapForUser(
      created.mindmap.id,
      owner.id,
      1,
      integrationClient,
    )).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await integrationClient.node.count({ where: { mindmapId: created.mindmap.id } })).toBe(2);

    await expect(deleteMindmapForUser(
      created.mindmap.id,
      owner.id,
      2,
      integrationClient,
    )).resolves.toEqual({
      deletedMindmapId: created.mindmap.id,
      deletedNodeCount: 2,
    });
    expect(await integrationClient.mindmap.findUnique({ where: { id: created.mindmap.id } })).toBeNull();
    expect(await integrationClient.node.count({ where: { mindmapId: created.mindmap.id } })).toBe(0);
  });

  it("allocates distinct sequences for concurrent requests", async () => {
    const user = await createTestUser("concurrent@example.test");
    const created = await Promise.all(
      Array.from({ length: 10 }, () => createMindmapWithRoot(user.id, integrationClient)),
    );
    const sequences = created.map(({ mindmap }) => mindmap.sequenceNo).sort((a, b) => a - b);

    expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps numbering independent per user", async () => {
    const [userA, userB] = await Promise.all([
      createTestUser("user-a@example.test"),
      createTestUser("user-b@example.test"),
    ]);
    const [mapA, mapB] = await Promise.all([
      createMindmapWithRoot(userA.id, integrationClient),
      createMindmapWithRoot(userB.id, integrationClient),
    ]);

    expect(mapA.mindmap.sequenceNo).toBe(1);
    expect(mapB.mindmap.sequenceNo).toBe(1);
  });
});
