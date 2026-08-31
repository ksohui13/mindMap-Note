import { Prisma, type Node, type PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/client";

import { DomainError, isPrismaError, mapPrismaError } from "./errors";
import { normalizeTitle, assertFinitePosition } from "./normalization";
import { countDescendants } from "./node.repository";
import { lockMindmapForUser, touchMindmap } from "./mindmap.repository";

export type CreateChildNodeInput = {
  id?: string;
  mindmapId: string;
  parentNodeId: string;
  title: string;
  x: number;
  y: number;
};

export type UpdateNodeInput = {
  title?: string;
  contentMd?: string;
  x?: number;
  y?: number;
  isCollapsed?: boolean;
};

export type CreateOwnedChildNodeResult = {
  node: Node;
  mindmapUpdatedAt: Date;
};

export async function createChildNode(
  input: CreateChildNodeInput,
  client: PrismaClient = prisma,
): Promise<Node> {
  assertFinitePosition(input.x, input.y);
  const nodeId = input.id ?? randomUUID();

  try {
    return await client.$transaction(async (transaction) => {
      const parent = await transaction.node.findUnique({
        where: { id: input.parentNodeId },
      });

      if (!parent) {
        throw new DomainError("NOT_FOUND", "Parent node was not found.");
      }

      if (parent.mindmapId !== input.mindmapId) {
        throw new DomainError(
          "DATA_INTEGRITY",
          "Parent node must belong to the same mindmap.",
        );
      }

      const node = await transaction.node.create({
        data: {
          id: nodeId,
          mindmapId: input.mindmapId,
          parentNodeId: input.parentNodeId,
          title: normalizeTitle(input.title),
          x: input.x,
          y: input.y,
        },
      });
      await touchMindmap(input.mindmapId, transaction);

      return node;
    });
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    return mapPrismaError(error);
  }
}

export async function createChildNodeForUser(
  input: CreateChildNodeInput,
  userId: string,
  client: PrismaClient = prisma,
): Promise<CreateOwnedChildNodeResult> {
  assertFinitePosition(input.x, input.y);
  const title = normalizeTitle(input.title);
  const nodeId = input.id ?? randomUUID();

  try {
    return await client.$transaction(async (transaction) => {
      if (!(await lockMindmapForUser(input.mindmapId, userId, transaction))) {
        throw new DomainError("NOT_FOUND", "Mindmap was not found.");
      }

      const existing = await transaction.node.findUnique({ where: { id: nodeId } });
      if (existing) {
        if (
          existing.mindmapId !== input.mindmapId ||
          existing.parentNodeId !== input.parentNodeId
        ) {
          throw new DomainError("CONFLICT", "Node id is already in use.");
        }
        const currentMindmap = await transaction.mindmap.findUniqueOrThrow({
          where: { id: input.mindmapId },
          select: { updatedAt: true },
        });
        return { node: existing, mindmapUpdatedAt: currentMindmap.updatedAt };
      }

      const parent = await transaction.node.findUnique({
        where: { id: input.parentNodeId },
        select: { mindmapId: true },
      });
      if (!parent || parent.mindmapId !== input.mindmapId) {
        throw new DomainError(
          "DATA_INTEGRITY",
          "Parent node must belong to the same mindmap.",
        );
      }

      const node = await transaction.node.create({
        data: {
          id: nodeId,
          mindmapId: input.mindmapId,
          parentNodeId: input.parentNodeId,
          title,
          x: input.x,
          y: input.y,
        },
      });
      await touchMindmap(input.mindmapId, transaction);
      const updatedMindmap = await transaction.mindmap.findUniqueOrThrow({
        where: { id: input.mindmapId },
        select: { updatedAt: true },
      });

      return { node, mindmapUpdatedAt: updatedMindmap.updatedAt };
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isPrismaError(error, "P2002")) {
      const concurrent = await client.node.findUnique({ where: { id: nodeId } });
      if (concurrent) {
        if (
          concurrent.mindmapId !== input.mindmapId ||
          concurrent.parentNodeId !== input.parentNodeId
        ) {
          throw new DomainError("CONFLICT", "Node id is already in use.");
        }
        const owner = await client.mindmap.findFirst({
          where: { id: input.mindmapId, userId },
          select: { updatedAt: true },
        });
        if (!owner) throw new DomainError("NOT_FOUND", "Mindmap was not found.");
        return { node: concurrent, mindmapUpdatedAt: owner.updatedAt };
      }
    }
    return mapPrismaError(error);
  }
}

export async function updateNode(
  nodeId: string,
  input: UpdateNodeInput,
  client: PrismaClient = prisma,
): Promise<Node> {
  if (Object.keys(input).length === 0) {
    throw new DomainError("INVALID_INPUT", "At least one node field is required.");
  }

  try {
    return await client.$transaction(async (transaction) => {
      const existing = await transaction.node.findUnique({ where: { id: nodeId } });

      if (!existing) {
        throw new DomainError("NOT_FOUND", "Node was not found.");
      }

      if (input.x !== undefined || input.y !== undefined) {
        assertFinitePosition(input.x ?? existing.x, input.y ?? existing.y);
      }

      const updated = await transaction.node.update({
        where: { id: nodeId },
        data: {
          ...(input.title === undefined
            ? {}
            : { title: normalizeTitle(input.title) }),
          ...(input.contentMd === undefined
            ? {}
            : { contentMd: input.contentMd }),
          ...(input.x === undefined ? {} : { x: input.x }),
          ...(input.y === undefined ? {} : { y: input.y }),
          ...(input.isCollapsed === undefined
            ? {}
            : { isCollapsed: input.isCollapsed }),
          revision: { increment: 1 },
        },
      });
      await touchMindmap(existing.mindmapId, transaction);

      return updated;
    });
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    return mapPrismaError(error);
  }
}

export function updateNodeTitle(
  nodeId: string,
  title: string,
  client: PrismaClient = prisma,
): Promise<Node> {
  return updateNode(nodeId, { title }, client);
}

type OwnedNodeMutation = {
  title?: string;
  contentMd?: string;
  x?: number;
  y?: number;
  isCollapsed?: boolean;
};

async function updateOwnedNodeWithRevision(
  nodeId: string,
  userId: string,
  revision: number,
  data: OwnedNodeMutation,
  client: PrismaClient,
): Promise<Node> {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new DomainError("INVALID_INPUT", "Node revision must be a non-negative integer.");
  }

  try {
    return await client.$transaction(async (transaction) => {
      const existing = await transaction.node.findFirst({
        where: { id: nodeId, mindmap: { userId } },
        select: { id: true, mindmapId: true },
      });
      if (!existing) {
        throw new DomainError("NOT_FOUND", "Node was not found.");
      }

      const result = await transaction.node.updateMany({
        where: { id: nodeId, revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (result.count === 0) {
        const current = await transaction.node.findFirst({
          where: { id: nodeId, mindmap: { userId } },
          select: { revision: true },
        });
        if (!current) throw new DomainError("NOT_FOUND", "Node was not found.");
        throw new DomainError(
          "CONFLICT",
          "Node was changed by another request.",
          undefined,
          { currentRevision: current.revision },
        );
      }

      const updated = await transaction.node.findUniqueOrThrow({ where: { id: nodeId } });
      await touchMindmap(existing.mindmapId, transaction);
      return updated;
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapPrismaError(error);
  }
}

export async function updateNodeTitleForUser(
  nodeId: string,
  userId: string,
  title: string,
  revision: number,
  client: PrismaClient = prisma,
): Promise<Node> {
  const normalizedTitle = normalizeTitle(title);
  return updateOwnedNodeWithRevision(
    nodeId,
    userId,
    revision,
    { title: normalizedTitle },
    client,
  );
}

export function updateNodePositionForUser(
  nodeId: string,
  userId: string,
  x: number,
  y: number,
  revision: number,
  client: PrismaClient = prisma,
): Promise<Node> {
  assertFinitePosition(x, y);
  return updateOwnedNodeWithRevision(nodeId, userId, revision, { x, y }, client);
}

export async function updateNodePositionsForUser(
  mindmapId: string,
  userId: string,
  updates: readonly Readonly<{
    id: string;
    x: number;
    y: number;
    revision: number;
  }>[],
  client: PrismaClient = prisma,
): Promise<{ nodes: Node[]; mindmapUpdatedAt: Date }> {
  if (updates.length === 0) {
    throw new DomainError("INVALID_INPUT", "At least one node position is required.");
  }
  const ids = new Set<string>();
  for (const update of updates) {
    assertFinitePosition(update.x, update.y);
    if (!Number.isInteger(update.revision) || update.revision < 0) {
      throw new DomainError("INVALID_INPUT", "Node revision must be a non-negative integer.");
    }
    if (ids.has(update.id)) {
      throw new DomainError("INVALID_INPUT", "Node ids must be unique.");
    }
    ids.add(update.id);
  }

  try {
    return await client.$transaction(async (transaction) => {
      if (!(await lockMindmapForUser(mindmapId, userId, transaction))) {
        throw new DomainError("NOT_FOUND", "Mindmap was not found.");
      }
      const ownedNodes = await transaction.node.findMany({
        where: { id: { in: [...ids] }, mindmapId },
        select: { id: true, revision: true },
      });
      if (ownedNodes.length !== updates.length) {
        throw new DomainError("NOT_FOUND", "One or more nodes were not found.");
      }
      const revisionById = new Map(ownedNodes.map((node) => [node.id, node.revision]));

      for (const update of updates) {
        const currentRevision = revisionById.get(update.id);
        if (currentRevision !== update.revision) {
          throw new DomainError(
            "CONFLICT",
            "One or more nodes were changed by another request.",
            undefined,
            { currentRevision: currentRevision ?? -1 },
          );
        }
        const result = await transaction.node.updateMany({
          where: { id: update.id, mindmapId, revision: update.revision },
          data: { x: update.x, y: update.y, revision: { increment: 1 } },
        });
        if (result.count !== 1) {
          throw new DomainError(
            "CONFLICT",
            "One or more nodes were changed by another request.",
          );
        }
      }

      await touchMindmap(mindmapId, transaction);
      const [nodes, mindmap] = await Promise.all([
        transaction.node.findMany({ where: { id: { in: [...ids] }, mindmapId } }),
        transaction.mindmap.findUniqueOrThrow({
          where: { id: mindmapId },
          select: { updatedAt: true },
        }),
      ]);
      const byId = new Map(nodes.map((node) => [node.id, node]));
      return {
        nodes: updates.map((update) => {
          const node = byId.get(update.id);
          if (!node) throw new DomainError("NOT_FOUND", "One or more nodes were not found.");
          return node;
        }),
        mindmapUpdatedAt: mindmap.updatedAt,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isPrismaError(error, "P2034")) {
      throw new DomainError(
        "CONFLICT",
        "One or more nodes were changed by another request.",
        error,
      );
    }
    return mapPrismaError(error);
  }
}

export function updateNodeCollapseForUser(
  nodeId: string,
  userId: string,
  isCollapsed: boolean,
  revision: number,
  client: PrismaClient = prisma,
): Promise<Node> {
  if (typeof isCollapsed !== "boolean") {
    throw new DomainError("INVALID_INPUT", "Node collapse state must be a boolean.");
  }
  return updateOwnedNodeWithRevision(
    nodeId,
    userId,
    revision,
    { isCollapsed },
    client,
  );
}

export async function getNodeContentForUser(
  nodeId: string,
  userId: string,
  client: PrismaClient = prisma,
): Promise<Node> {
  const node = await client.node.findFirst({
    where: { id: nodeId, mindmap: { userId } },
  });
  if (!node) {
    throw new DomainError("NOT_FOUND", "Node was not found.");
  }
  return node;
}

export function updateNodeContentForUser(
  nodeId: string,
  userId: string,
  contentMd: string,
  revision: number,
  client: PrismaClient = prisma,
): Promise<Node> {
  return updateOwnedNodeWithRevision(
    nodeId,
    userId,
    revision,
    { contentMd },
    client,
  );
}

export async function deleteNodeSubtree(
  nodeId: string,
  client: PrismaClient = prisma,
): Promise<{ deletedCount: number }> {
  try {
    return await client.$transaction(async (transaction) => {
      const node = await transaction.node.findUnique({ where: { id: nodeId } });

      if (!node) {
        throw new DomainError("NOT_FOUND", "Node was not found.");
      }

      if (node.parentNodeId === null) {
        throw new DomainError(
          "ROOT_DELETE_FORBIDDEN",
          "Root node cannot be deleted.",
        );
      }

      const descendantCount = await countDescendants(nodeId, transaction);
      await transaction.node.delete({ where: { id: nodeId } });
      await touchMindmap(node.mindmapId, transaction);

      return { deletedCount: descendantCount + 1 };
    });
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    return mapPrismaError(error);
  }
}

export async function getNodeDeletionImpactForUser(
  nodeId: string,
  userId: string,
  client: PrismaClient = prisma,
): Promise<{
  node: { id: string; title: string };
  descendantCount: number;
  totalDeleteCount: number;
}> {
  try {
    return await client.$transaction(async (transaction) => {
      const node = await transaction.node.findFirst({
        where: { id: nodeId, mindmap: { userId } },
        select: { id: true, title: true, parentNodeId: true },
      });
      if (!node) throw new DomainError("NOT_FOUND", "Node was not found.");
      if (node.parentNodeId === null) {
        throw new DomainError("ROOT_DELETE_FORBIDDEN", "Root node cannot be deleted.");
      }
      const descendantCount = await countDescendants(node.id, transaction);
      return {
        node: { id: node.id, title: node.title },
        descendantCount,
        totalDeleteCount: descendantCount + 1,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapPrismaError(error);
  }
}

export async function deleteNodeSubtreeForUser(
  nodeId: string,
  userId: string,
  expectedDeleteCount: number,
  client: PrismaClient = prisma,
): Promise<{ deletedNodeId: string; deletedCount: number; mindmapUpdatedAt: Date }> {
  if (!Number.isInteger(expectedDeleteCount) || expectedDeleteCount < 1) {
    throw new DomainError("INVALID_INPUT", "Expected delete count must be a positive integer.");
  }

  try {
    return await client.$transaction(async (transaction) => {
      const node = await transaction.node.findFirst({
        where: { id: nodeId, mindmap: { userId } },
        select: { id: true, mindmapId: true, parentNodeId: true },
      });
      if (!node) throw new DomainError("NOT_FOUND", "Node was not found.");
      if (!(await lockMindmapForUser(node.mindmapId, userId, transaction))) {
        throw new DomainError("NOT_FOUND", "Node was not found.");
      }
      if (node.parentNodeId === null) {
        throw new DomainError("ROOT_DELETE_FORBIDDEN", "Root node cannot be deleted.");
      }

      const deletedCount = (await countDescendants(node.id, transaction)) + 1;
      if (deletedCount !== expectedDeleteCount) {
        throw new DomainError(
          "CONFLICT",
          "Node subtree changed. Review the deletion impact and try again.",
        );
      }

      await transaction.node.delete({ where: { id: node.id } });
      const mindmap = await transaction.mindmap.update({
        where: { id: node.mindmapId },
        data: { updatedAt: new Date() },
        select: { updatedAt: true },
      });
      return {
        deletedNodeId: node.id,
        deletedCount,
        mindmapUpdatedAt: mindmap.updatedAt,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isPrismaError(error, "P2034")) {
      throw new DomainError(
        "CONFLICT",
        "Node subtree changed. Review the deletion impact and try again.",
        error,
      );
    }
    return mapPrismaError(error);
  }
}
