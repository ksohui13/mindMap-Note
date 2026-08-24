import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ExportMindmapInput } from "@/features/mindmap/api/contracts";
import { prisma } from "@/server/db/client";

import { DomainError, mapPrismaError } from "./errors";
import {
  buildContentDisposition,
  buildExportFilename,
  renderMindmapMarkdown,
  type ExportDocumentNode,
} from "./mindmap-export";
import { validateMindmapTree } from "./mindmap-tree";

type TreeMetadata = Readonly<{
  id: string;
  parentNodeId: string | null;
  title: string;
  createdAt: Date;
}>;

export type MindmapExportResult = Readonly<{
  markdown: string;
  filename: string;
  contentDisposition: string;
}>;

export async function exportMindmapForUser(
  mindmapId: string,
  userId: string,
  input: ExportMindmapInput,
  client: PrismaClient = prisma,
): Promise<MindmapExportResult> {
  try {
    return await client.$transaction(async (transaction) => {
      const mindmap = await transaction.mindmap.findFirst({
        where: { id: mindmapId, userId },
        select: { id: true, title: true },
      });
      if (!mindmap) throw new DomainError("NOT_FOUND", "Mindmap was not found.");

      const metadata = await transaction.node.findMany({
        where: { mindmapId: mindmap.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, parentNodeId: true, title: true, createdAt: true },
      });
      const rootNodeId = validateMindmapTree(metadata);
      const byId = new Map(metadata.map((node) => [node.id, node]));
      const target = input.scope === "ALL" ? undefined : byId.get(input.nodeId);
      if (input.scope !== "ALL" && !target) {
        throw new DomainError("NOT_FOUND", "Node was not found.");
      }

      const fullOrder = buildPreorder(metadata, rootNodeId);
      const pathById = buildPaths(fullOrder, byId);
      const included = selectExportNodes(fullOrder, input, target?.id);
      const contentRows = await transaction.node.findMany({
        where: { id: { in: included.map((node) => node.id) }, mindmapId: mindmap.id },
        select: { id: true, contentMd: true },
      });
      const contentById = new Map(contentRows.map((node) => [node.id, node.contentMd]));
      const baseDepth = included[0] ? pathById.get(included[0].id)?.length ?? 1 : 1;
      const documentNodes: ExportDocumentNode[] = included.map((node) => ({
        id: node.id,
        parentNodeId: node.parentNodeId,
        title: node.title,
        contentMd: contentById.get(node.id) ?? "",
        path: pathById.get(node.id)?.map((pathNode) => pathNode.title) ?? [node.title],
        depth: input.scope === "ALL"
          ? (pathById.get(node.id)?.length ?? 1) - 1
          : (pathById.get(node.id)?.length ?? 1) - baseDepth,
      }));
      const filename = buildExportFilename(mindmap.title, input.scope);
      return {
        filename,
        contentDisposition: buildContentDisposition(filename),
        markdown: renderMindmapMarkdown({
          mindmapTitle: mindmap.title,
          scope: input.scope,
          targetNodeTitle: target?.title,
          nodes: documentNodes,
        }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return mapPrismaError(error);
  }
}

function buildPreorder(nodes: readonly TreeMetadata[], rootNodeId: string): TreeMetadata[] {
  const children = new Map<string, TreeMetadata[]>();
  for (const node of nodes) {
    if (!node.parentNodeId) continue;
    const siblings = children.get(node.parentNodeId) ?? [];
    siblings.push(node);
    children.set(node.parentNodeId, siblings);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(rootNodeId);
  if (!root) throw new DomainError("DATA_INTEGRITY", "Mindmap root node is missing.");
  const ordered: TreeMetadata[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    ordered.push(node);
    const nodeChildren = children.get(node.id) ?? [];
    for (let index = nodeChildren.length - 1; index >= 0; index -= 1) {
      stack.push(nodeChildren[index]);
    }
  }
  return ordered;
}

function buildPaths(
  ordered: readonly TreeMetadata[],
  byId: ReadonlyMap<string, TreeMetadata>,
): Map<string, readonly TreeMetadata[]> {
  const paths = new Map<string, readonly TreeMetadata[]>();
  for (const node of ordered) {
    if (!node.parentNodeId) {
      paths.set(node.id, [node]);
      continue;
    }
    const parent = byId.get(node.parentNodeId);
    const parentPath = parent ? paths.get(parent.id) : undefined;
    if (!parentPath) throw new DomainError("DATA_INTEGRITY", "Node path is invalid.");
    paths.set(node.id, [...parentPath, node]);
  }
  return paths;
}

function selectExportNodes(
  ordered: readonly TreeMetadata[],
  input: ExportMindmapInput,
  targetNodeId?: string,
): TreeMetadata[] {
  if (input.scope === "ALL") return [...ordered];
  if (!targetNodeId) throw new DomainError("NOT_FOUND", "Node was not found.");
  if (input.scope === "NODE") {
    const target = ordered.find((node) => node.id === targetNodeId);
    return target ? [target] : [];
  }
  const included = new Set([targetNodeId]);
  for (const node of ordered) {
    if (node.parentNodeId && included.has(node.parentNodeId)) included.add(node.id);
  }
  return ordered.filter((node) => included.has(node.id));
}
