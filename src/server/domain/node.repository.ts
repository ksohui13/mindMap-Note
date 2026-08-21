import { Prisma, type Node } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";

export function findNodeById(
  id: string,
  client: DatabaseClient = prisma,
): Promise<Node | null> {
  return client.node.findUnique({ where: { id } });
}

export async function countDescendants(
  nodeId: string,
  client: DatabaseClient = prisma,
): Promise<number> {
  const rows = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    WITH RECURSIVE descendants AS (
      SELECT "id"
      FROM "Node"
      WHERE "parentNodeId" = ${nodeId}::uuid

      UNION ALL

      SELECT child."id"
      FROM "Node" child
      INNER JOIN descendants parent ON child."parentNodeId" = parent."id"
    )
    SELECT COUNT(*)::bigint AS "count" FROM descendants
  `);

  return Number(rows[0]?.count ?? BigInt(0));
}
