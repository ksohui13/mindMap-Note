import { describe, expect, it } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { toMindmapFlow } from "@/features/mindmap/model/flow-adapter";

const detail: MindmapDetailResponse = {
  mindmap: { id: "map", title: "Map", updatedAt: "2026-08-19T00:00:00.000Z" },
  rootNodeId: "root",
  nodes: [
    { id: "root", parentNodeId: null, title: "Root", x: 10, y: 20, isCollapsed: false, revision: 0 },
    { id: "child", parentNodeId: "root", title: "Child", x: 210, y: 80, isCollapsed: false, revision: 2 },
    { id: "grandchild", parentNodeId: "child", title: "Grandchild", x: 410, y: 140, isCollapsed: true, revision: 3 },
  ],
};

describe("toMindmapFlow", () => {
  it("preserves positions and maps root, descendants, and stable edges", () => {
    const flow = toMindmapFlow(detail, "child");

    expect(flow.nodes.map((node) => ({ id: node.id, position: node.position }))).toEqual([
      { id: "root", position: { x: 10, y: 20 } },
      { id: "child", position: { x: 210, y: 80 } },
      { id: "grandchild", position: { x: 410, y: 140 } },
    ]);
    expect(flow.nodes[0].data.isRoot).toBe(true);
    expect(flow.nodes[1].selected).toBe(true);
    expect(flow.nodes.every((node) => node.draggable === false && node.connectable === false)).toBe(true);
    expect(flow.edges).toMatchObject([
      { id: "edge:root:child", source: "root", target: "child" },
      { id: "edge:child:grandchild", source: "child", target: "grandchild" },
    ]);
  });
});
