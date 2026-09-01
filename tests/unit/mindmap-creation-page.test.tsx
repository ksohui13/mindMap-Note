import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { MindmapCreationPage } from "@/features/mindmap/components/mindmap-creation-page";
import { mindmapDetailQueryKey } from "@/features/mindmap/hooks/use-mindmap-detail";

vi.mock("@/features/mindmap/components/mindmap-editor", () => ({
  MindmapEditor: ({ initialData }: { initialData: MindmapDetailResponse }) => (
    <div data-testid="creation-editor">{initialData.mindmap.title}</div>
  ),
}));

const mindmapId = "64ae3d6a-2fcf-44f2-8619-29eb725fd1f2";
const rootNodeId = "197c9309-bb27-4d11-8071-c99b8728fc7b";
const detail: MindmapDetailResponse = {
  mindmap: {
    id: mindmapId,
    title: "새로운 마인드맵 1",
    updatedAt: "2026-09-01T00:00:00.000Z",
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
};

function renderCreationPage(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <MindmapCreationPage mindmapId={mindmapId} rootNodeId={rootNodeId} />,
    { wrapper },
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("MindmapCreationPage", () => {
  it("renders the Dashboard creation cache without sending a duplicate POST", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(mindmapDetailQueryKey(mindmapId), detail);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCreationPage(client);

    expect(screen.getByTestId("creation-editor")).toHaveTextContent("새로운 마인드맵 1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(`/mindmaps/${mindmapId}`);
  });
});
