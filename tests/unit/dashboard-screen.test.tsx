import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen, formatMindmapUpdatedAt } from "@/features/dashboard/components/dashboard-screen";
import type { MindmapSummaryDTO } from "@/features/mindmap/api/contracts";

const push = vi.fn();
const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch, replace: vi.fn(), refresh: vi.fn() }),
}));

const mindmap: MindmapSummaryDTO = {
  id: "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2",
  title: "제품 아이디어",
  sequenceNo: 1,
  updatedAt: "2026-08-19T03:00:00.000Z",
  nodeCount: 7,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<DashboardScreen user={{ email: "user@example.test" }} />, { wrapper });
}

function openCardMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "제품 아이디어 메뉴" }),
    { button: 0, ctrlKey: false },
  );
}

beforeEach(() => {
  push.mockReset();
  prefetch.mockReset();
  vi.unstubAllGlobals();
});

describe("DashboardScreen", () => {
  it("renders loading and then the empty state", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderDashboard();

    expect(screen.getByLabelText("마인드맵 목록 불러오는 중")).toBeInTheDocument();
    resolveFetch?.(jsonResponse({ mindmaps: [] }));
    expect(await screen.findByText("첫 마인드맵을 만들어 보세요")).toBeInTheDocument();
  });

  it("renders real summary data with rename and delete actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ mindmaps: [mindmap] })));
    renderDashboard();

    expect(await screen.findByText("제품 아이디어")).toBeInTheDocument();
    expect(screen.getByText("노드 7개")).toBeInTheDocument();
    expect(screen.getByText(`${formatMindmapUpdatedAt(mindmap.updatedAt)} 수정`)).toBeInTheDocument();
    const card = screen.getByText("제품 아이디어").closest("article");
    openCardMenu();
    const menu = screen.getByRole("menu");
    expect(screen.getByRole("menuitem", { name: "이름 변경" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Markdown 내보내기" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "삭제" })).toBeInTheDocument();
    expect(card).not.toContainElement(menu);
  });

  it("shows the confirmed node count and removes a mindmap only after deletion succeeds", async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      return Promise.resolve(jsonResponse({ mindmaps: [mindmap] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await screen.findByText("제품 아이디어");

    openCardMenu();
    const entry = screen.getByRole("menuitem", { name: "삭제" });
    entry.focus();
    fireEvent.click(entry);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("마인드맵과 포함된 노드 7개가 모두 삭제됩니다.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/mindmaps/${mindmap.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );

    const confirm = within(dialog).getByRole("button", { name: "삭제" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(await within(dialog).findByRole("button", { name: /삭제 중/ })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")?.[1]?.body)))
      .toEqual({ expectedNodeCount: 7 });
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();

    resolveDelete?.(jsonResponse({ deletedMindmapId: mindmap.id, deletedNodeCount: 7 }));
    await waitFor(() => expect(screen.queryByText("제품 아이디어")).not.toBeInTheDocument());
  });

  it("prevents duplicate creation and opens the created mindmap", async () => {
    const rootNodeId = "197c9309-bb27-4d11-8071-c99b8728fc7b";
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(mindmap.id)
      .mockReturnValueOnce(rootNodeId);
    let resolveCreate: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolveCreate = resolve; });
      }
      return Promise.resolve(jsonResponse({ mindmaps: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await screen.findByText("첫 마인드맵을 만들어 보세요");

    const creationHref = `/mindmaps/${mindmap.id}?rootNodeId=${rootNodeId}&initialEdit=1&create=1`;
    expect(prefetch).toHaveBeenCalledWith(creationHref);

    const createButton = screen.getByRole("button", { name: "+ 새 마인드맵" });
    fireEvent.click(createButton);
    fireEvent.click(createButton);
    expect(await screen.findByRole("button", { name: "마인드맵 만드는 중…" })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body)))
      .toEqual({ mindmapId: mindmap.id, rootNodeId });
    expect(push).not.toHaveBeenCalled();

    resolveCreate?.(jsonResponse({
      mindmap: { ...mindmap, nodeCount: 1 },
      rootNodeId,
      detail: {
        mindmap: {
          id: mindmap.id,
          title: mindmap.title,
          updatedAt: mindmap.updatedAt,
        },
        rootNodeId,
        nodes: [{
          id: rootNodeId,
          parentNodeId: null,
          title: "시작",
          x: 0,
          y: 0,
          isCollapsed: false,
          revision: 0,
        }],
      },
    }, 201));
    await waitFor(() => expect(push).toHaveBeenCalledWith(creationHref));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("keeps the prepared ids and allows retry after creation fails", async () => {
    const mindmapId = "8c599609-c1cf-4187-b470-6b9d9db03327";
    const rootNodeId = "e29cf805-f76f-4751-a98b-619d989ff87a";
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(mindmapId)
      .mockReturnValueOnce(rootNodeId);
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(
      init?.method === "POST"
        ? jsonResponse({ error: { code: "INTERNAL_ERROR", message: "failed" } }, 500)
        : jsonResponse({ mindmaps: [] }),
    ));
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await screen.findByText("첫 마인드맵을 만들어 보세요");

    fireEvent.click(screen.getByRole("button", { name: "+ 새 마인드맵" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("마인드맵을 만들지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "+ 새 마인드맵" }));

    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
      expect(posts).toHaveLength(2);
      expect(posts.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
        { mindmapId, rootNodeId },
        { mindmapId, rootNodeId },
      ]);
    });
  });

  it("supports Enter rename and rolls back a failed request", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ error: { code: "CONFLICT", message: "failed" } }, 409));
      }
      return Promise.resolve(jsonResponse({ mindmaps: [mindmap] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await screen.findByText("제품 아이디어");

    openCardMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "이름 변경" }));
    const input = screen.getByRole("textbox", { name: "마인드맵 이름" });
    fireEvent.change(input, { target: { value: "새 이름" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("이름을 변경하지 못했습니다. 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();
  });

  it("cancels with Escape and restores a blank title on blur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ mindmaps: [mindmap] })));
    renderDashboard();
    await screen.findByText("제품 아이디어");

    openCardMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "이름 변경" }));
    let input = screen.getByRole("textbox", { name: "마인드맵 이름" });
    fireEvent.change(input, { target: { value: "취소할 이름" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();

    openCardMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "이름 변경" }));
    input = screen.getByRole("textbox", { name: "마인드맵 이름" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(screen.getByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();
  });
});
