import { describe, expect, it } from "vitest";

import { calculateChildPosition } from "@/features/mindmap/model/node-position";

describe("calculateChildPosition", () => {
  const parent = { id: "parent", x: 100, y: 200 };

  it("places the first child to the right of its parent", () => {
    expect(calculateChildPosition(parent, [])).toEqual({ x: 340, y: 200 });
  });

  it("uses deterministic alternating vertical slots without reusing occupied positions", () => {
    const nodes = [
      { parentNodeId: "parent", x: 340, y: 200 },
      { parentNodeId: "parent", x: 340, y: 296 },
      { parentNodeId: "other", x: 340, y: 104 },
    ];

    expect(calculateChildPosition(parent, nodes)).toEqual({ x: 340, y: 104 });
  });
});
