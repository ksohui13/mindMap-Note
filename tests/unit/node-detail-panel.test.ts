import { describe, expect, it } from "vitest";

import { getDetailPanelBounds } from "@/features/mindmap/components/node-detail";

describe("getDetailPanelBounds", () => {
  it.each([
    [375, { min: 320, max: 320 }],
    [640, { min: 320, max: 320 }],
    [1_440, { min: 320, max: 560 }],
  ])("uses dynamic sidebar bounds at a %ipx viewport", (viewport, expected) => {
    expect(getDetailPanelBounds(viewport)).toEqual(expected);
  });
});
