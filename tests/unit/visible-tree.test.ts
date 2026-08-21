import { describe, expect, it } from "vitest";

import type { MindmapNodeDTO } from "@/features/mindmap/api/contracts";
import {
  applyNodeViewOverrides,
  getDescendantIds,
  nodesWithChildren,
  selectVisibleNodes,
} from "@/features/mindmap/model/visible-tree";

const nodes: MindmapNodeDTO[] = [
  { id: "root", parentNodeId: null, title: "Root", x: 0, y: 0, isCollapsed: false, revision: 0 },
  { id: "a", parentNodeId: "root", title: "A", x: 100, y: 0, isCollapsed: false, revision: 0 },
  { id: "b", parentNodeId: "root", title: "B", x: 100, y: 100, isCollapsed: false, revision: 0 },
  { id: "a-1", parentNodeId: "a", title: "A1", x: 200, y: 0, isCollapsed: false, revision: 0 },
  { id: "a-2", parentNodeId: "a", title: "A2", x: 200, y: 50, isCollapsed: false, revision: 0 },
  { id: "a-1-1", parentNodeId: "a-1", title: "A11", x: 300, y: 0, isCollapsed: false, revision: 0 },
];

describe("visible tree selectors", () => {
  it("hides every descendant of a collapsed branch without affecting siblings", () => {
    const effective = applyNodeViewOverrides(nodes, {}, { a: true });
    expect(selectVisibleNodes(effective, "root").map((node) => node.id)).toEqual([
      "root",
      "a",
      "b",
    ]);
  });

  it("supports nested and root collapse while preserving stored positions", () => {
    const nested = applyNodeViewOverrides(nodes, { "a-1": { x: 777, y: 888 } }, { "a-1": true });
    expect(selectVisibleNodes(nested, "root").map((node) => node.id)).toEqual([
      "root",
      "a",
      "b",
      "a-1",
      "a-2",
    ]);
    expect(nested.find((node) => node.id === "a-1")).toMatchObject({ x: 777, y: 888 });
    expect(selectVisibleNodes(applyNodeViewOverrides(nodes, {}, { root: true }), "root"))
      .toHaveLength(1);
  });

  it("returns descendants and only nodes that actually have children", () => {
    expect(getDescendantIds(nodes, "a")).toEqual(new Set(["a-1", "a-2", "a-1-1"]));
    expect(nodesWithChildren(nodes)).toEqual(new Set(["root", "a", "a-1"]));
  });
});
