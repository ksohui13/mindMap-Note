import { Prisma, type Mindmap, type Node } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";

export function findMindmapForUser(
  id: string,
  userId: string,
  client: DatabaseClient = prisma,
): Promise<Mindmap | null> {
  return client.mindmap.findFirst({ where: { id, userId } });
}

export async function lockMindmapForUser(
  id: string,
  userId: string,
  client: DatabaseClient,
): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Mindmap"
    WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `);
  return rows.length === 1;
}

export function listMindmapsForUser(
  userId: string,
  client: DatabaseClient = prisma,
): Promise<MindmapWithNodeCount[]> {
  return client.mindmap.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { nodes: true } } },
  });
}

export type MindmapWithNodeCount = Prisma.MindmapGetPayload<{
  include: { _count: { select: { nodes: true } } };
}>;

export type MindmapDetailRecord = Prisma.MindmapGetPayload<{
  select: {
    id: true;
    title: true;
    updatedAt: true;
    nodes: {
      select: {
        id: true;
        parentNodeId: true;
        title: true;
        x: true;
        y: true;
        isCollapsed: true;
        revision: true;
      };
    };
  };
}>;

export function findMindmapDetailForUser(
  id: string,
  userId: string,
  client: DatabaseClient = prisma,
): Promise<MindmapDetailRecord | null> {
  return client.mindmap.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      nodes: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          parentNodeId: true,
          title: true,
          x: true,
          y: true,
          isCollapsed: true,
          revision: true,
        },
      },
    },
  });
}

export async function findMindmapEntryForUser(
  id: string,
  userId: string,
  client: DatabaseClient = prisma,
): Promise<{ mindmap: Mindmap; rootNode: Node } | null> {
  const mindmap = await findMindmapForUser(id, userId, client);
  if (!mindmap) return null;

  const rootNode = await client.node.findFirst({
    where: { mindmapId: id, parentNodeId: null },
  });
  if (!rootNode) return null;

  return { mindmap, rootNode };
}

export async function touchMindmap(
  id: string,
  client: DatabaseClient,
): Promise<void> {
  await client.mindmap.update({
    where: { id },
    data: { updatedAt: new Date() },
  });
}
