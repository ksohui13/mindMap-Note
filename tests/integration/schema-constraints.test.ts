import { describe, expect, it } from "vitest";

import { createSession } from "@/server/domain/session.repository";
import { createUser } from "@/server/domain/user.repository";

import { integrationClient } from "./client";

describe("database constraints", () => {
  it("normalizes service-created email and rejects non-normalized direct values", async () => {
    const user = await createUser(
      { email: "  User@Example.COM ", passwordHash: "disabled" },
      integrationClient,
    );
    expect(user.email).toBe("user@example.com");

    await expect(
      integrationClient.user.create({
        data: { email: "UPPER@example.com", passwordHash: "disabled" },
      }),
    ).rejects.toBeDefined();
  });

  it("enforces unique email and SHA-256 session hashes", async () => {
    const user = await createUser(
      { email: "unique@example.test", passwordHash: "disabled" },
      integrationClient,
    );
    await expect(
      createUser(
        { email: " UNIQUE@example.test ", passwordHash: "disabled" },
        integrationClient,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      integrationClient.session.create({
        data: { userId: user.id, tokenHash: "invalid", expiresAt: new Date() },
      }),
    ).rejects.toBeDefined();

    const session = await createSession(
      {
        userId: user.id,
        tokenHash: "A".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
      integrationClient,
    );
    expect(session.tokenHash).toBe("a".repeat(64));
  });

  it("rejects blank titles, invalid sequence numbers, and negative revisions", async () => {
    const user = await createUser(
      { email: "checks@example.test", passwordHash: "disabled" },
      integrationClient,
    );
    await expect(
      integrationClient.mindmap.create({
        data: { userId: user.id, title: "   ", sequenceNo: 1 },
      }),
    ).rejects.toBeDefined();
    await expect(
      integrationClient.mindmap.create({
        data: { userId: user.id, title: "Valid", sequenceNo: 0 },
      }),
    ).rejects.toBeDefined();

    const mindmap = await integrationClient.mindmap.create({
      data: { userId: user.id, title: "Valid", sequenceNo: 1 },
    });
    await expect(
      integrationClient.node.create({
        data: { mindmapId: mindmap.id, title: " ", revision: 0 },
      }),
    ).rejects.toBeDefined();
    await expect(
      integrationClient.node.create({
        data: { mindmapId: mindmap.id, title: "Valid", revision: -1 },
      }),
    ).rejects.toBeDefined();
  });

  it("allows exactly one root per mindmap", async () => {
    const user = await createUser(
      { email: "root@example.test", passwordHash: "disabled" },
      integrationClient,
    );
    const mindmap = await integrationClient.mindmap.create({
      data: { userId: user.id, title: "Map", sequenceNo: 1 },
    });
    await integrationClient.node.create({
      data: { mindmapId: mindmap.id, title: "Root" },
    });
    await expect(
      integrationClient.node.create({
        data: { mindmapId: mindmap.id, title: "Second root" },
      }),
    ).rejects.toBeDefined();
  });

  it("enforces sequence uniqueness within each user", async () => {
    const user = await createUser(
      { email: "sequence-constraint@example.test", passwordHash: "disabled" },
      integrationClient,
    );
    await integrationClient.mindmap.create({
      data: { userId: user.id, title: "First", sequenceNo: 1 },
    });

    await expect(
      integrationClient.mindmap.create({
        data: { userId: user.id, title: "Duplicate", sequenceNo: 1 },
      }),
    ).rejects.toBeDefined();
  });
});
