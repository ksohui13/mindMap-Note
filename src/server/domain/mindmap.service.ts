import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";

import { DomainError, isPrismaError, mapPrismaError } from "./errors";
import {
  findMindmapEntryForUser,
  findMindmapDetailForUser,
  findMindmapForUser,
  listMindmapsForUser,
} from "./mindmap.repository";
import { validateMindmapTree } from "./mindmap-tree";
import { normalizeTitle } from "./normalization";
import { findUserById } from "./user.repository";

const MAX_TRANSACTION_ATTEMPTS = 5;

export type CreatedMindmap = Awaited<ReturnType<typeof createMindmapAttempt>>;

async function createMindmapAttempt(client: PrismaClient, userId: string) {
  return client.$transaction(
    async (transaction) => {
      const aggregate = await transaction.mindmap.aggregate({
        where: { userId },
        _max: { sequenceNo: true },
      });
      const sequenceNo = (aggregate._max.sequenceNo ?? 0) + 1;
      const mindmap = await transaction.mindmap.create({
        data: {
          userId,
          sequenceNo,
          title: `새로운 마인드맵 ${sequenceNo}`,
        },
      });
      const rootNode = await transaction.node.create({
        data: {
          mindmapId: mindmap.id,
          title: "시작",
          x: 0,
          y: 0,
        },
      });

      return { mindmap, rootNode };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function waitBeforeRetry(attempt: number): Promise<void> {
  const delayMs = Math.min(10 * 2 ** attempt, 80);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function createMindmapWithRoot(
  userId: string,
  client: PrismaClient = prisma,
): Promise<CreatedMindmap> {
  if (!(await findUserById(userId, client))) {
    throw new DomainError("NOT_FOUND", "User was not found.");
  }

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await createMindmapAttempt(client, userId);
    } catch (error) {
      const retryable = isPrismaError(error, "P2034") || isPrismaError(error, "P2002");

      if (!retryable) {
        return mapPrismaError(error);
      }

      if (attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw new DomainError(
          "CONFLICT",
          "Mindmap sequence allocation failed after retries.",
          error,
        );
      }

      await waitBeforeRetry(attempt);
    }
  }

  throw new DomainError("CONFLICT", "Mindmap creation failed.");
}

export function listMindmapsWithNodeCount(
  userId: string,
  client: PrismaClient = prisma,
) {
  return listMindmapsForUser(userId, client);
}

export async function updateMindmapTitle(
  mindmapId: string,
  userId: string,
  title: string,
  client: PrismaClient = prisma,
) {
  const normalizedTitle = normalizeTitle(title);

  try {
    return await client.$transaction(async (transaction) => {
      const existing = await findMindmapForUser(mindmapId, userId, transaction);
      if (!existing) {
        throw new DomainError("NOT_FOUND", "Mindmap was not found.");
      }

      return transaction.mindmap.update({
        where: { id: existing.id },
        data: { title: normalizedTitle },
        include: { _count: { select: { nodes: true } } },
      });
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapPrismaError(error);
  }
}

export async function getMindmapEntryForUser(
  mindmapId: string,
  userId: string,
  client: PrismaClient = prisma,
) {
  const entry = await findMindmapEntryForUser(mindmapId, userId, client);
  if (!entry) {
    throw new DomainError("NOT_FOUND", "Mindmap was not found.");
  }
  return entry;
}

export async function getMindmapDetailForUser(
  mindmapId: string,
  userId: string,
  client: DatabaseClient = prisma,
) {
  const detail = await findMindmapDetailForUser(mindmapId, userId, client);
  if (!detail) {
    throw new DomainError("NOT_FOUND", "Mindmap was not found.");
  }
  const rootNodeId = validateMindmapTree(detail.nodes);
  return { ...detail, rootNodeId };
}
