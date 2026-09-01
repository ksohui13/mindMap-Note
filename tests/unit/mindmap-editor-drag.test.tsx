import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import type { MindmapFlowNode } from "@/features/mindmap/model/flow-adapter";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

type MockReactFlowProps = {
  nodes: MindmapFlowNode[];
  nodesDraggable?: boolean;
  onNodeDragStart?: unknown;
  onNodeDragStop?: unknown;
};

function MockReactFlow({ nodes, nodesDraggable, onNodeDragStart, onNodeDragStop }: MockReactFlowProps) {
  return (
    <div
      data-testid="react-flow"
      data-node-count={nodes.length}
      data-nodes-draggable={String(nodesDraggable)}
      data-has-drag-start={String(Boolean(onNodeDragStart))}
      data-has-drag-stop={String(Boolean(onNodeDragStop))}
    />
  );
}

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  Handle: () => null,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ReactFlow: MockReactFlow,
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";

const detail: MindmapDetailResponse = {
  mindmap: { id: "map-1", title: "Drag", updatedAt: "2026-08-21T00:00:00.000Z" },
  rootNodeId: "root",
  nodes: [{
    id: "root",
    parentNodeId: null,
    title: "Root",
    x: 0,
    y: 0,
    isCollapsed: false,
    revision: 0,
  }],
};

describe("MindmapEditor node dragging", () => {
  it("disables node dragging and does not register drag handlers", () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MindmapEditor mindmapId="map-1" initialData={detail} />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("마인드맵 캔버스")).toHaveAttribute("data-nodes-draggable", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-nodes-draggable", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-drag-start", "false");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-has-drag-stop", "false");
  });
});
