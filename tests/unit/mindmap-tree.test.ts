import { describe, expect, it } from "vitest";

import { validateMindmapTree } from "@/server/domain/mindmap-tree";

function node(id: string, parentNodeId: string | null) {
  return { id, parentNodeId, title: id, x: 0, y: 0, isCollapsed: false, revision: 0 };
}

describe("validateMindmapTree", () => {
  it("accepts one connected deep tree and returns its root", () => {
    expect(validateMindmapTree([node("root", null), node("a", "root"), node("b", "a")])).toBe("root");
  });

  it.each([
    ["missing root", [node("a", "b"), node("b", "a")]],
    ["multiple roots", [node("a", null), node("b", null)]],
    ["foreign parent", [node("root", null), node("child", "other-map-node")]],
    ["disconnected cycle", [node("root", null), node("a", "b"), node("b", "a")]],
  ])("rejects %s", (_label, nodes) => {
    expect(() => validateMindmapTree(nodes)).toThrowError(expect.objectContaining({ code: "DATA_INTEGRITY" }));
  });
});
