import type { Node, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";

import { DomainError, mapPrismaError } from "./errors";
import { normalizeTitle, assertFinitePosition } from "./normalization";
import { countDescendants } from "./node.repository";
import { touchMindmap } from "./mindmap.repository";

export type CreateChildNodeInput = {
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

export async function createChildNode(
  input: CreateChildNodeInput,
  client: PrismaClient = prisma,
): Promise<Node> {
  assertFinitePosition(input.x, input.y);

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
