import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen, formatMindmapUpdatedAt } from "@/features/dashboard/components/dashboard-screen";
import type { MindmapSummaryDTO } from "@/features/mindmap/api/contracts";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
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

beforeEach(() => {
  push.mockReset();
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
    expect(screen.getByRole("button", { name: "이름 변경" })).toBeInTheDocument();
    expect(screen.queryByText("내보내기")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
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

    const entry = screen.getByRole("button", { name: "삭제" });
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
    let resolveCreate: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/mindmaps" && init?.method === "POST") {
        return new Promise<Response>((resolve) => { resolveCreate = resolve; });
      }
      return Promise.resolve(jsonResponse({ mindmaps: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await screen.findByText("첫 마인드맵을 만들어 보세요");

    const createButton = screen.getByRole("button", { name: "+ 새 마인드맵" });
    fireEvent.click(createButton);
    fireEvent.click(createButton);
    expect(await screen.findByRole("button", { name: "만드는 중..." })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveCreate?.(jsonResponse({ mindmap, rootNodeId: "197c9309-bb27-4d11-8071-c99b8728fc7b" }, 201));
    await waitFor(() => expect(push).toHaveBeenCalledWith(
      `/mindmaps/${mindmap.id}?rootNodeId=197c9309-bb27-4d11-8071-c99b8728fc7b&initialEdit=1`,
    ));
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

    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
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

    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
    let input = screen.getByRole("textbox", { name: "마인드맵 이름" });
    fireEvent.change(input, { target: { value: "취소할 이름" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
    input = screen.getByRole("textbox", { name: "마인드맵 이름" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(screen.getByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("제품 아이디어")).toBeInTheDocument();
  });
});
