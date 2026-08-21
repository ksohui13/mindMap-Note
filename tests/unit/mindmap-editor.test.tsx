import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));

const detail: MindmapDetailResponse = {
  mindmap: { id: "map-1", title: "Editor 테스트", updatedAt: "2026-08-19T00:00:00.000Z" },
  rootNodeId: "root",
  nodes: [
    { id: "root", parentNodeId: null, title: "시작", x: 0, y: 0, isCollapsed: false, revision: 0 },
    { id: "child", parentNodeId: "root", title: "자식", x: 220, y: 80, isCollapsed: false, revision: 0 },
  ],
};

function renderEditor(initialData?: MindmapDetailResponse, initialRootSelection = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <div style={{ width: 900, height: 700 }}>
      <MindmapEditor mindmapId="map-1" initialData={initialData} initialRootSelection={initialRootSelection} />
    </div>,
    { wrapper },
  );
}

beforeEach(() => vi.unstubAllGlobals());

describe("MindmapEditor", () => {
  it("renders nodes, an edge, navigation controls, and truthful server state", async () => {
    const { container } = renderEditor(detail, true);

    expect(screen.getByRole("heading", { name: "Editor 테스트" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("서버에서 불러옴");
    expect(screen.getByTestId("root-node")).toHaveClass("ring-4");
    expect(screen.getByText("자식")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확대" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "축소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "화면 맞춤" })).toBeInTheDocument();
    const canvas = screen.getByRole("region", { name: "마인드맵 캔버스" });
    expect(canvas).toHaveAttribute("data-nodes-draggable", "false");
    expect(canvas).toHaveAttribute("data-nodes-connectable", "false");
    expect(canvas).toHaveAttribute("data-delete-enabled", "false");

    await waitFor(() => expect(container.querySelectorAll(".react-flow__edge")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    fireEvent.click(screen.getByRole("button", { name: "화면 맞춤" }));
  });

  it("selects a node and clears selection from the pane", async () => {
    const { container } = renderEditor(detail);
    const childTitle = screen.getByText("자식");
    fireEvent.click(childTitle);
    expect(screen.getByTestId("mindmap-node")).toHaveClass("ring-4");

    const pane = container.querySelector(".react-flow__pane");
    expect(pane).not.toBeNull();
    fireEvent.click(pane as Element);
    expect(screen.getByTestId("mindmap-node")).not.toHaveClass("ring-4");
  });

  it("shows loading then an actionable API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "failed" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    )));
    renderEditor();

    expect(screen.getByLabelText("마인드맵 불러오는 중")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "마인드맵을 불러오지 못했습니다" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
