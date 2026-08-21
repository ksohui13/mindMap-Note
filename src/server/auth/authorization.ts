import "server-only";

import type { Mindmap } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";
import { DomainError } from "@/server/domain/errors";
import { findMindmapForUser } from "@/server/domain/mindmap.repository";

export async function requireOwnedMindmap(
  mindmapId: string,
  userId: string,
  client: DatabaseClient = prisma,
): Promise<Mindmap> {
  const mindmap = await findMindmapForUser(mindmapId, userId, client);
  if (!mindmap) {
    throw new DomainError("NOT_FOUND", "Mindmap was not found.");
  }
  return mindmap;
}
