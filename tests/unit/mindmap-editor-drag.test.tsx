import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import type { MindmapFlowNode } from "@/features/mindmap/model/flow-adapter";

type MockReactFlowProps = {
  nodes: MindmapFlowNode[];
  onNodesChange?: (changes: Array<{
    id: string;
    type: "position";
    position: { x: number; y: number };
    dragging: boolean;
  }>) => void;
  onNodeDragStop?: (event: MouseEvent, node: MindmapFlowNode) => void;
};

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  BackgroundVariant: { Dots: "dots" },
  Handle: () => null,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ReactFlow: ({ nodes, onNodesChange, onNodeDragStop }: MockReactFlowProps) => (
    <div>
      <output data-testid="node-position">{nodes[0].position.x},{nodes[0].position.y}</output>
      <button
        type="button"
        onClick={() => onNodesChange?.([{
          id: nodes[0].id,
          type: "position",
          position: { x: 80, y: 50 },
          dragging: true,
        }])}
      >
        drag move
      </button>
      <button
        type="button"
        onClick={() => onNodeDragStop?.(
          new MouseEvent("mouseup"),
          { ...nodes[0], position: { x: 80, y: 50 } },
        )}
      >
        drag stop
      </button>
      {nodes[0].data.mutationError ? (
        <div>
          <span>{nodes[0].data.mutationError.message}</span>
          <button type="button" onClick={() => nodes[0].data.onRetryMutation?.(nodes[0].id)}>
            retry position
          </button>
          <button type="button" onClick={() => nodes[0].data.onRevertMutation?.(nodes[0].id)}>
            revert position
          </button>
        </div>
      ) : null}
    </div>
  ),
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

beforeEach(() => vi.unstubAllGlobals());

describe("MindmapEditor drag persistence", () => {
  it("does not call the API while moving and saves once on drag stop", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      node: { ...detail.nodes[0], x: 80, y: 50, revision: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MindmapEditor mindmapId="map-1" initialData={detail} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "drag move" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "drag stop" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/nodes/root/position");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      x: 80,
      y: 50,
      revision: 0,
    });
  });

  it("keeps a failed local position and restores the cached server position explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "INTERNAL_ERROR", message: "위치 저장 실패" },
    }), { status: 500, headers: { "content-type": "application/json" } })));
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MindmapEditor mindmapId="map-1" initialData={detail} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "drag move" }));
    expect(screen.getByTestId("node-position")).toHaveTextContent("80,50");
    fireEvent.click(screen.getByRole("button", { name: "drag stop" }));

    expect(await screen.findByText("위치 저장 실패")).toBeInTheDocument();
    expect(screen.getByTestId("node-position")).toHaveTextContent("80,50");
    fireEvent.click(screen.getByRole("button", { name: "revert position" }));
    expect(screen.getByTestId("node-position")).toHaveTextContent("0,0");
  });
});
