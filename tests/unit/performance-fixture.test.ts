import { describe, expect, it } from "vitest";

import { buildPerformanceNodes } from "../../scripts/performance/fixture";

describe("performance fixture", () => {
  it("builds a deterministic 4-ary tree with bounded Markdown", () => {
    const input = { mindmapId: "map", count: 1_000, group: 200 } as const;
    const first = buildPerformanceNodes(input);
    const second = buildPerformanceNodes(input);

    expect(first).toEqual(second);
    expect(first).toHaveLength(1_000);
    expect(first[0]?.parentNodeId).toBeNull();
    expect(first[1]?.parentNodeId).toBe(first[0]?.id);
    expect(first[4]?.parentNodeId).toBe(first[0]?.id);
    expect(first[5]?.parentNodeId).toBe(first[1]?.id);
    expect(Math.max(...first.map((node) => new TextEncoder().encode(node.contentMd).byteLength)))
      .toBeLessThanOrEqual(1_024);
  });

  it("collapses exactly the sixteen depth-two branches", () => {
    const nodes = buildPerformanceNodes({
      mindmapId: "map",
      count: 1_000,
      group: 300,
      collapseDepthTwo: true,
    });
    expect(nodes.filter((node) => node.isCollapsed)).toHaveLength(16);
  });
});
