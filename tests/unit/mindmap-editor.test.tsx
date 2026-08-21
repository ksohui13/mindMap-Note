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
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
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

  it("opens the newly created root in edit mode with its title selected", () => {
    renderEditor(detail, true);

    const input = screen.getByLabelText("노드 제목") as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input).toHaveValue("시작");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(2);
  });

  it("creates a child at a deterministic position and immediately edits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      node: {
        id: "new-child",
        parentNodeId: "root",
        title: "새 노드",
        x: 240,
        y: 0,
        isCollapsed: false,
        revision: 0,
      },
      mindmapUpdatedAt: "2026-08-21T00:00:00.000Z",
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    const addButton = screen.getByLabelText("시작에 자식 노드 추가");
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const input = await screen.findByLabelText("노드 제목");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("새 노드");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      parentNodeId: "root",
      title: "새 노드",
      x: 240,
      y: 0,
    });
    expect(document.querySelector('[data-id="new-child"]')).not.toBeNull();
  });

  it("keeps child creation actionable after a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "노드 생성 실패" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    )));
    renderEditor(detail);

    fireEvent.click(screen.getByLabelText("시작에 자식 노드 추가"));

    expect(await screen.findByText("노드 생성 실패")).toBeInTheDocument();
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
    expect(screen.queryByLabelText("노드 제목")).not.toBeInTheDocument();
  });

  it("edits with Enter, cancels with Escape, and protects IME composition", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      node: { ...detail.nodes[1], title: "변경", revision: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    fireEvent.doubleClick(screen.getByText("자식"));
    let input = screen.getByLabelText("노드 제목");
    fireEvent.change(input, { target: { value: "취소할 제목" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("노드 제목")).not.toBeInTheDocument();
    expect(screen.getByText("자식")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("자식"));
    input = screen.getByLabelText("노드 제목");
    fireEvent.change(input, { target: { value: "변경" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });
    fireEvent.keyDown(input, { key: "Enter", isComposing: false, keyCode: 13 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("변경")).toBeInTheDocument());
  });

  it("restores a blank title and keeps a failed draft available for retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "저장 실패" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    fireEvent.doubleClick(screen.getByText("자식"));
    const input = screen.getByLabelText("노드 제목");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("자식");
    expect(screen.getByText("노드 제목을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "유지할 초안" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("저장 실패")).toBeInTheDocument());
    expect(input).toHaveValue("유지할 초안");
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });
});
