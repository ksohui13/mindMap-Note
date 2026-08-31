import { describe, expect, it } from "vitest";

import {
  calculateChildPosition,
  calculateRevealedNodePositions,
  hasPositionCollision,
} from "@/features/mindmap/model/node-position";

describe("calculateChildPosition", () => {
  const parent = { id: "parent", x: 100, y: 200 };

  it("places the first child to the right of its parent", () => {
    expect(calculateChildPosition(parent, [])).toEqual({ x: 420, y: 200 });
  });

  it("uses deterministic alternating vertical slots around all visible obstacles", () => {
    const nodes = [
      { x: 420, y: 200 },
      { x: 420, y: 400 },
      { x: 420, y: 0 },
    ];

    expect(calculateChildPosition(parent, nodes)).toEqual({ x: 420, y: 600 });
  });

  it("does not reuse synchronous reservations during rapid creation", () => {
    const reservations: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < 10; index += 1) {
      reservations.push(calculateChildPosition(parent, [], reservations));
    }

    for (const [index, position] of reservations.entries()) {
      expect(hasPositionCollision(position, reservations.filter((_, candidate) => candidate !== index))).toBe(false);
    }
  });
});

describe("calculateRevealedNodePositions", () => {
  it("moves only newly revealed nodes and preserves fixed and already valid positions", () => {
    const nodes = [
      { id: "root", parentNodeId: null, x: 0, y: 0 },
      { id: "fixed", parentNodeId: "root", x: 320, y: 0 },
      { id: "revealed-a", parentNodeId: "root", x: 320, y: 0 },
      { id: "revealed-b", parentNodeId: "revealed-a", x: 640, y: 0 },
    ];
    const positions = calculateRevealedNodePositions(
      nodes,
      new Set(["root", "fixed"]),
      new Set(["revealed-a", "revealed-b"]),
    );

    expect(positions.root).toBeUndefined();
    expect(positions.fixed).toBeUndefined();
    expect(positions["revealed-a"]).toEqual({ x: 320, y: 200 });
    expect(positions["revealed-b"]).toEqual({ x: 640, y: 200 });
  });

  it("leaves a newly revealed node unchanged when its stored rectangle is free", () => {
    const positions = calculateRevealedNodePositions(
      [
        { id: "root", parentNodeId: null, x: 0, y: 0 },
        { id: "child", parentNodeId: "root", x: 640, y: 400 },
      ],
      new Set(["root"]),
      new Set(["child"]),
    );
    expect(positions).toEqual({});
  });
});
