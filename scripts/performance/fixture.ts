import type { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/server/auth/password";

export const PERFORMANCE_EMAIL = "performance@example.test";
export const PERFORMANCE_PASSWORD = "performance-password-12";
export const PERFORMANCE_USER_ID = "00000000-0000-4000-8000-000000000012";

export const PERFORMANCE_MAPS = {
  hundred: {
    id: "00000000-0000-4000-8000-000000000100",
    title: "Performance 100",
    sequenceNo: 1,
    count: 100,
    group: 100,
    collapsed: false,
  },
  expanded: {
    id: "00000000-0000-4000-8000-000000001000",
    title: "Performance 1000 Expanded",
    sequenceNo: 2,
    count: 1_000,
    group: 200,
    collapsed: false,
  },
  collapsed: {
    id: "00000000-0000-4000-8000-000000001001",
    title: "Performance 1000 Collapsed",
    sequenceNo: 3,
    count: 1_000,
    group: 300,
    collapsed: true,
  },
} as const;

type PerformanceMapDefinition = (typeof PERFORMANCE_MAPS)[keyof typeof PERFORMANCE_MAPS];
export type PerformanceNodeSeed = Readonly<{
  id: string;
  mindmapId: string;
  parentNodeId: string | null;
  title: string;
  contentMd: string;
  x: number;
  y: number;
  isCollapsed: boolean;
}>;

export async function seedPerformanceFixtures(client: PrismaClient): Promise<void> {
  await client.user.deleteMany({ where: { email: PERFORMANCE_EMAIL } });
  await client.user.create({
    data: {
      id: PERFORMANCE_USER_ID,
      email: PERFORMANCE_EMAIL,
      passwordHash: await hashPassword(PERFORMANCE_PASSWORD),
    },
  });
  for (const definition of Object.values(PERFORMANCE_MAPS)) {
    await createPerformanceMap(client, definition);
  }
}

export async function createPerformanceMap(
  client: PrismaClient,
  definition: PerformanceMapDefinition,
): Promise<void> {
  await client.mindmap.create({
    data: {
      id: definition.id,
      userId: PERFORMANCE_USER_ID,
      sequenceNo: definition.sequenceNo,
      title: definition.title,
    },
  });
  await insertTreeNodes(client, {
    mindmapId: definition.id,
    count: definition.count,
    group: definition.group,
    collapseDepthTwo: definition.collapsed,
  });
}

export async function createDeletionFixture(
  client: PrismaClient,
  sample: number,
): Promise<{ mindmapId: string; subtreeRootId: string }> {
  const group = 500 + sample;
  const mindmapId = uuidFor(group, 999_999);
  const outerRootId = uuidFor(group, 999_998);
  await client.mindmap.create({
    data: {
      id: mindmapId,
      userId: PERFORMANCE_USER_ID,
      sequenceNo: 100 + sample,
      title: `Performance Delete ${sample}`,
    },
  });
  await client.node.create({
    data: { id: outerRootId, mindmapId, title: "Deletion container", x: 0, y: 0 },
  });
  const subtreeRootId = uuidFor(group, 0);
  await insertTreeNodes(client, {
    mindmapId,
    count: 1_000,
    group,
    rootParentNodeId: outerRootId,
  });
  return { mindmapId, subtreeRootId };
}

async function insertTreeNodes(
  client: PrismaClient,
  {
    mindmapId,
    count,
    group,
    collapseDepthTwo = false,
    rootParentNodeId = null,
  }: {
    mindmapId: string;
    count: number;
    group: number;
    collapseDepthTwo?: boolean;
    rootParentNodeId?: string | null;
  },
): Promise<void> {
  const nodes = buildPerformanceNodes({
    mindmapId,
    count,
    group,
    collapseDepthTwo,
    rootParentNodeId,
  });
  const maxDepth = Math.max(...nodes.map((_node, index) => treeDepth(index)));
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const level = nodes.filter((_node, index) => treeDepth(index) === depth);
    if (level.length > 0) await client.node.createMany({ data: level });
  }
}

export function buildPerformanceNodes({
  mindmapId,
  count,
  group,
  collapseDepthTwo = false,
  rootParentNodeId = null,
}: {
  mindmapId: string;
  count: number;
  group: number;
  collapseDepthTwo?: boolean;
  rootParentNodeId?: string | null;
}): PerformanceNodeSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const depth = treeDepth(index);
    const parentIndex = index === 0 ? null : Math.floor((index - 1) / 4);
    return {
      id: uuidFor(group, index),
      mindmapId,
      parentNodeId: parentIndex === null ? rootParentNodeId : uuidFor(group, parentIndex),
      title: `Node ${String(index + 1).padStart(4, "0")}`,
      contentMd: performanceMarkdown(index),
      x: depth * 260,
      y: index * 72,
      isCollapsed: collapseDepthTwo && depth === 2,
    };
  });
}

function treeDepth(index: number): number {
  let depth = 0;
  let current = index;
  while (current > 0) {
    current = Math.floor((current - 1) / 4);
    depth += 1;
  }
  return depth;
}

function performanceMarkdown(index: number): string {
  const prefix = `# Performance node ${index + 1}\n\n- deterministic fixture\n- markdown detail\n\n`;
  const code = "```ts\nconst measured = true;\n```\n\n";
  return `${prefix}${code}${"content ".repeat(120)}`.slice(0, 1_024);
}

function uuidFor(group: number, index: number): string {
  const suffix = String(group * 1_000_000 + index).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}
