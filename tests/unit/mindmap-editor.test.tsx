import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";
import { createDraftJournalEntry, draftJournalKey, writeDraftJournal } from "@/features/mindmap/lib/draft-journal";
import { hasPositionCollision } from "@/features/mindmap/model/node-position";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}));

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

beforeEach(() => {
  replace.mockReset();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("MindmapEditor", () => {
  it("renames and deletes the whole mindmap from the detail header", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({
          mindmap: {
            id: "map-1",
            title: "바뀐 맵 제목",
            sequenceNo: 1,
            updatedAt: "2026-08-31T00:00:00.000Z",
            nodeCount: 2,
          },
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({
          deletedMindmapId: "map-1",
          deletedNodeCount: 2,
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      throw new Error(`Unexpected request: ${String(_input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    fireEvent.click(screen.getByRole("button", { name: "제목 수정" }));
    const titleInput = screen.getByRole("textbox", { name: "마인드맵 제목" });
    fireEvent.change(titleInput, { target: { value: "바뀐 맵 제목" } });
    fireEvent.keyDown(titleInput, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "바뀐 맵 제목" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(JSON.parse(String(deleteCall?.[1]?.body))).toEqual({ expectedNodeCount: 2 });
  });

  it("renders nodes, an edge, navigation controls, and truthful server state", async () => {
    const { container } = renderEditor(detail, true);

    expect(screen.getByRole("heading", { name: "Editor 테스트" })).toBeInTheDocument();
    expect(screen.getByText("서버와 동기화됨")).toBeInTheDocument();
    expect(screen.getByTestId("root-node")).toHaveClass("ring-4");
    expect(screen.getByText("자식")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확대" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "축소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "화면 맞춤" })).toBeInTheDocument();
    const canvas = screen.getByRole("region", { name: "마인드맵 캔버스" });
    expect(canvas).toHaveAttribute("data-nodes-draggable", "true");
    expect(canvas).toHaveAttribute("data-nodes-connectable", "false");
    expect(canvas).toHaveAttribute("data-delete-enabled", "false");
    expect(screen.getByLabelText("시작 메뉴")).toBeInTheDocument();
    expect(screen.getByLabelText("자식 메뉴")).toBeInTheDocument();

    await waitFor(() => expect(container.querySelectorAll(".react-flow__edge")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    fireEvent.click(screen.getByRole("button", { name: "화면 맞춤" }));
  });

  it("selects a node without opening detail and opens detail only from its button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      node: { id: "child", title: "자식", contentMd: "", revision: 0 },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const { container } = renderEditor(detail);
    const childNode = container.querySelector('[data-id="child"]');
    expect(childNode).not.toBeNull();
    fireEvent.click(childNode as Element);
    expect(screen.getByTestId("mindmap-node")).toHaveClass("ring-4");
    expect(screen.queryByLabelText("노드 상세 패널")).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("자식"));
    expect(screen.getByLabelText("노드 제목")).toBeInTheDocument();
    expect(screen.queryByLabelText("노드 상세 패널")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("노드 제목"), { key: "Escape" });

    fireEvent.click(screen.getByLabelText("자식 상세 열기"));
    expect(await screen.findByLabelText("노드 상세 패널")).toBeInTheDocument();

    const pane = container.querySelector(".react-flow__pane");
    expect(pane).not.toBeNull();
    fireEvent.click(pane as Element);
    expect(screen.getByTestId("mindmap-node")).not.toHaveClass("ring-4");
    expect(screen.queryByLabelText("노드 상세 패널")).not.toBeInTheDocument();
  });

  it("flushes a Markdown draft immediately from the detail save button", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({
          node: { id: "child", title: "자식", contentMd: "즉시 저장", revision: 1 },
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        node: { id: "child", title: "자식", contentMd: "", revision: 0 },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    fireEvent.click(screen.getByLabelText("자식 상세 열기"));
    const textarea = await screen.findByLabelText("Markdown 내용");
    const resizeHandle = screen.getByRole("separator", { name: "노드 상세 패널 너비 조절" });
    fireEvent.keyDown(resizeHandle, { key: "ArrowLeft" });
    expect(resizeHandle).toHaveAttribute("aria-valuenow", "376");
    fireEvent.change(textarea, { target: { value: "즉시 저장" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    const saveCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({ contentMd: "즉시 저장", revision: 0 });
  });

  it("confirms the latest subtree impact and cleans only the deleted subtree after success", async () => {
    const subtreeDetail: MindmapDetailResponse = {
      ...detail,
      nodes: [
        ...detail.nodes,
        { id: "grandchild", parentNodeId: "child", title: "손자", x: 440, y: 80, isCollapsed: false, revision: 0 },
        { id: "sibling", parentNodeId: "root", title: "형제", x: 220, y: 180, isCollapsed: false, revision: 0 },
      ],
    };
    writeDraftJournal(localStorage, createDraftJournalEntry("map-1", "child", "draft", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-1", "grandchild", "draft", 0));
    writeDraftJournal(localStorage, createDraftJournalEntry("map-1", "sibling", "keep", 0));
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/deletion-impact")) {
        return Promise.resolve(new Response(JSON.stringify({
          node: { id: "child", title: "자식" },
          descendantCount: 1,
          totalDeleteCount: 2,
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({
          deletedNodeId: "child",
          deletedCount: 2,
          mindmapUpdatedAt: "2026-08-24T01:00:00.000Z",
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(subtreeDetail);

    const childMenu = screen.getByLabelText("자식 메뉴").parentElement;
    expect(childMenu).not.toBeNull();
    fireEvent.pointerDown(screen.getByLabelText("자식 메뉴"), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText("하위 개념 1개도 함께 삭제됩니다.")).toBeInTheDocument();
    expect(screen.getAllByText("자식").length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByText("자식")).not.toBeInTheDocument());
    expect(screen.queryByText("손자")).not.toBeInTheDocument();
    expect(screen.getByText("형제")).toBeInTheDocument();
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(JSON.parse(String(deleteCall?.[1]?.body))).toEqual({ expectedDeleteCount: 2 });
    expect(localStorage.getItem(draftJournalKey("map-1", "child"))).toBeNull();
    expect(localStorage.getItem(draftJournalKey("map-1", "grandchild"))).toBeNull();
    expect(localStorage.getItem(draftJournalKey("map-1", "sibling"))).not.toBeNull();
  });

  it("isolates node drafts and preserves canvas state through fullscreen", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const isChild = url.includes("/nodes/child/content");
      const submitted = init?.method === "PATCH"
        ? (JSON.parse(String(init.body)) as { contentMd: string })
        : null;
      return new Response(JSON.stringify({
        node: {
          id: isChild ? "child" : "root",
          title: isChild ? "자식" : "시작",
          contentMd: submitted?.contentMd ?? (isChild ? "# 자식 서버 내용" : "# 루트 서버 내용"),
          revision: submitted ? 1 : 0,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderEditor(detail);

    fireEvent.click(screen.getByLabelText("자식 상세 열기"));
    const childEditor = await screen.findByLabelText("Markdown 내용");
    fireEvent.change(childEditor, { target: { value: "# 자식 초안" } });
    expect(screen.getAllByText("저장 대기 중").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("시작 상세 열기"));
    expect(await screen.findByDisplayValue("# 루트 서버 내용")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("자식 상세 열기"));
    expect(await screen.findByDisplayValue("# 자식 초안")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "미리보기" }));
    expect(screen.getByRole("heading", { name: "자식 초안" })).toBeInTheDocument();

    const viewport = container.querySelector(".react-flow__viewport");
    const viewportStyle = viewport?.getAttribute("style");
    const fullscreenButton = screen.getByLabelText("상세 전체화면 열기");
    fireEvent.click(fullscreenButton);
    expect(screen.getByRole("dialog", { name: "자식 상세 전체화면" })).toBeInTheDocument();
    expect(screen.getByTestId("mindmap-node")).toHaveClass("ring-4");
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(fullscreenButton).toHaveFocus());
    expect(screen.getByLabelText("노드 상세 패널")).toBeInTheDocument();
    expect(viewport?.getAttribute("style")).toBe(viewportStyle);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows an actionable node content loading error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "failed" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    fireEvent.click(screen.getByLabelText("자식 상세 열기"));

    expect(await screen.findByText("노드 상세를 불러오지 못했습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
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
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return Promise.resolve(new Response(JSON.stringify({
        node: {
          id: body.id,
          parentNodeId: "root",
          title: "새 노드",
          x: 320,
          y: -200,
          isCollapsed: false,
          revision: 0,
        },
        mindmapUpdatedAt: "2026-08-21T00:00:00.000Z",
      }), { status: 201, headers: { "content-type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    const addButton = screen.getByLabelText("시작에 자식 노드 추가");
    fireEvent.click(addButton);

    const input = await screen.findByLabelText("노드 제목");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("새 노드");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(createBody).toEqual({
      id: expect.any(String),
      parentNodeId: "root",
      title: "새 노드",
      x: 320,
      y: -200,
    });
    expect(document.querySelector(`[data-id="${createBody.id}"]`)).not.toBeNull();
  });

  it("reserves non-overlapping rectangles for ten rapid child creations", async () => {
    const pending: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(() => new Promise<Response>((resolve) => pending.push(resolve)));
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(screen.getByLabelText("시작에 자식 노드 추가"));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(index + 1));
    }
    const created = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {
      id: string;
      x: number;
      y: number;
    });
    for (const [index, position] of created.entries()) {
      expect(hasPositionCollision(position, created.filter((_, candidate) => candidate !== index))).toBe(false);
    }

    created.forEach((node, index) => pending[index](new Response(JSON.stringify({
      node: {
        ...node,
        parentNodeId: "root",
        title: "새 노드",
        isCollapsed: false,
        revision: 0,
      },
      mindmapUpdatedAt: "2026-08-31T00:00:00.000Z",
    }), { status: 201, headers: { "content-type": "application/json" } })));
    await waitFor(() => expect(screen.getAllByText("새 노드")).toHaveLength(9));
    expect(screen.getByLabelText("노드 제목")).toHaveValue("새 노드");
  });

  it("keeps child creation actionable after a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "노드 생성 실패" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    )));
    renderEditor(detail);

    fireEvent.click(screen.getByLabelText("시작에 자식 노드 추가"));

    expect(await screen.findByText("노드 생성 실패")).toBeInTheDocument();
    expect(screen.getAllByText("다시 시도").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("노드 제목")).toHaveValue("새 노드");
    expect(screen.getByRole("button", { name: "임시 노드 제거" })).toBeInTheDocument();
  });

  it("collapses and expands descendants immediately while preserving the tree", async () => {
    const root = detail.nodes[0];
    let collapseRevision = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/content")) {
        return new Response(JSON.stringify({
          node: { id: "child", title: "자식", contentMd: "", revision: 0 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/nodes/positions")) {
        const body = JSON.parse(String(init?.body)) as { nodes: Array<{ id: string; x: number; y: number }> };
        return new Response(JSON.stringify({
          nodes: body.nodes.map((position) => ({
            ...detail.nodes.find((node) => node.id === position.id),
            ...position,
            revision: 1,
          })),
          mindmapUpdatedAt: "2026-08-31T00:00:00.000Z",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      collapseRevision += 1;
      return new Response(JSON.stringify({
        node: { ...root, isCollapsed: collapseRevision === 1, revision: collapseRevision },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderEditor(detail);

    expect(screen.queryByLabelText("자식 하위 트리 접기")).not.toBeInTheDocument();
    const childNode = screen.getByText("자식").closest('[data-id="child"]');
    expect(childNode).not.toBeNull();
    fireEvent.click(childNode as Element);
    fireEvent.click(screen.getByLabelText("시작 하위 트리 접기"));

    expect(screen.queryByText("자식")).not.toBeInTheDocument();
    expect(screen.getByTestId("root-node")).toHaveClass("ring-4");
    const addButton = screen.getByLabelText("시작에 자식 노드 추가");
    expect(addButton).toBeDisabled();
    expect(document.querySelectorAll(".react-flow__edge")).toHaveLength(0);

    const expandButton = await screen.findByLabelText("시작 하위 트리 펼치기");
    fireEvent.click(expandButton);
    await waitFor(() => expect(screen.getByText("자식")).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/collapse"))).toHaveLength(2);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/nodes/positions"))).toBe(true));
    const batchCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/nodes/positions"));
    expect(JSON.parse(String(batchCall?.[1]?.body))).toEqual({
      nodes: [{ id: "child", x: 320, y: 0, revision: 0 }],
    });
  });

  it("keeps a failed collapse locally and can restore the server state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "접기 저장 실패" } }),
      { status: 500, headers: { "content-type": "application/json" } },
    )));
    renderEditor(detail);

    fireEvent.click(screen.getByLabelText("시작 하위 트리 접기"));

    expect(screen.queryByText("자식")).not.toBeInTheDocument();
    expect(await screen.findByText("접기 저장 실패")).toBeInTheDocument();
    fireEvent.click(screen.getByText("서버 상태로 되돌리기"));
    expect(screen.getByText("자식")).toBeInTheDocument();
    expect(screen.queryByText("접기 저장 실패")).not.toBeInTheDocument();
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
    expect(input).toHaveValue("   ");
    expect(screen.getByText("노드 제목을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "유지할 초안" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("저장 실패")).toBeInTheDocument());
    expect(input).toHaveValue("유지할 초안");
    expect(screen.getAllByText("다시 시도").length).toBeGreaterThan(0);
  });
});
