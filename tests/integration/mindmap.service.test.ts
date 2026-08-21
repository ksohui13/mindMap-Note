import { describe, expect, it } from "vitest";

import { createMindmapWithRoot } from "@/server/domain/mindmap.service";
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

    await integrationClient.mindmap.delete({ where: { id: third.mindmap.id } });
    expect((await createMindmapWithRoot(user.id, integrationClient)).mindmap.sequenceNo).toBe(3);

    await integrationClient.mindmap.delete({ where: { id: second.mindmap.id } });
    expect((await createMindmapWithRoot(user.id, integrationClient)).mindmap.sequenceNo).toBe(4);
    expect(first.mindmap.sequenceNo).toBe(1);
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
