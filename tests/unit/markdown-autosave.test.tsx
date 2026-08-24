import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeContentResponse } from "@/features/mindmap/api/contracts";
import { useMarkdownAutosave } from "@/features/mindmap/hooks/use-markdown-autosave";
import { nodeContentQueryKey } from "@/features/mindmap/hooks/use-node-content";
import { useNodeMutationCoordinator } from "@/features/mindmap/hooks/use-node-mutation-coordinator";
import {
  createDraftJournalEntry,
  draftJournalKey,
  writeDraftJournal,
} from "@/features/mindmap/lib/draft-journal";

const serverContent: NodeContentResponse = {
  node: { id: "node-a", title: "Node A", contentMd: "server", revision: 0 },
};

describe("markdown autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resets the two second timer and deletes the journal only after confirmed save", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(nodeContentQueryKey("node-a"), serverContent);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body)) as { contentMd: string; revision: number };
      return new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: input.contentMd, revision: input.revision + 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => {
      const coordinator = useNodeMutationCoordinator([{ id: "node-a", revision: 0 }]);
      const autosave = useMarkdownAutosave({
        mindmapId: "map-a",
        selectedNodeId: "node-a",
        selectedContent: serverContent,
        coordinator,
      });
      return { coordinator, autosave };
    }, { wrapper });

    act(() => result.current.autosave.changeDraft("node-a", "first"));
    expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("dirty");
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toContain("first");

    await act(() => vi.advanceTimersByTimeAsync(1_500));
    act(() => result.current.autosave.changeDraft("node-a", "latest"));
    await act(() => vi.advanceTimersByTimeAsync(1_999));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      contentMd: "latest",
      revision: 0,
    });
    await vi.waitFor(() => expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("saved"));
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
  });

  it("flushes a dirty target immediately and waits for export readiness", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body)) as { contentMd: string; revision: number };
      return new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: input.contentMd, revision: input.revision + 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderAutosaveHook();

    act(() => result.current.autosave.changeDraft("node-a", "export latest"));
    let prepared!: Awaited<ReturnType<typeof result.current.autosave.prepareExport>>;
    await act(async () => {
      prepared = await result.current.autosave.prepareExport(["node-a"]);
    });

    expect(prepared).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      contentMd: "export latest",
    });
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
  });

  it("pauses editing for a different local journal and applies it as dirty", async () => {
    writeDraftJournal(
      localStorage,
      createDraftJournalEntry("map-a", "node-a", "recovered", 0),
    );
    const { result } = renderAutosaveHook();

    await vi.waitFor(() => expect(result.current.autosave.recovery?.contentMd).toBe("recovered"));
    act(() => result.current.autosave.applyRecovery("node-a"));

    expect(result.current.autosave.recovery).toBeUndefined();
    expect(result.current.autosave.drafts["node-a"]).toBe("recovered");
    expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("dirty");
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).not.toBeNull();
  });

  it("discards a recovery and silently removes a journal equal to the server", async () => {
    writeDraftJournal(
      localStorage,
      createDraftJournalEntry("map-a", "node-a", "local", 0),
    );
    const first = renderAutosaveHook();
    await vi.waitFor(() => expect(first.result.current.autosave.recovery).toBeDefined());
    act(() => first.result.current.autosave.discardRecovery("node-a"));
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
    first.unmount();

    writeDraftJournal(
      localStorage,
      createDraftJournalEntry("map-a", "node-a", serverContent.node.contentMd, 0),
    );
    const second = renderAutosaveHook();
    await vi.waitFor(() => {
      expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
    });
    expect(second.result.current.autosave.recovery).toBeUndefined();
  });

  it("best-effort flushes with keepalive on pagehide without deleting the journal", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body)) as { contentMd: string; revision: number };
      return new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: input.contentMd, revision: input.revision + 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderAutosaveHook();

    act(() => result.current.autosave.changeDraft("node-a", "leaving"));
    act(() => window.dispatchEvent(new Event("pagehide")));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[1]?.keepalive).toBe(true);
    await vi.waitFor(() => {
      expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("saved");
    });
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toContain("leaving");
  });

  it("shows saving and failed states, keeps the draft, and retries manually", async () => {
    const firstResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: "retry me", revision: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderAutosaveHook();
    let save!: Promise<void>;

    act(() => result.current.autosave.changeDraft("node-a", "retry me"));
    act(() => {
      save = result.current.autosave.flush("node-a");
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("saving");

    firstResponse.resolve(new Response(JSON.stringify({
      error: { code: "INTERNAL_ERROR", message: "temporary" },
    }), { status: 503, headers: { "content-type": "application/json" } }));
    await act(async () => save);
    expect(result.current.coordinator.getRecord("node-a", "content")).toMatchObject({
      phase: "failed",
      retryable: true,
    });
    expect(result.current.autosave.drafts["node-a"]).toBe("retry me");
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).not.toBeNull();

    act(() => result.current.coordinator.retry("node-a", "content"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => {
      expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("saved");
    });
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
  });

  it("pauses timers during deletion, resumes after failure, and discards only after success", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const input = JSON.parse(String(init?.body)) as { contentMd: string; revision: number };
      return new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: input.contentMd, revision: input.revision + 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderAutosaveHook();

    act(() => result.current.autosave.changeDraft("node-a", "protected draft"));
    act(() => result.current.autosave.pauseNodes(["node-a"]));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.autosave.drafts["node-a"]).toBe("protected draft");
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).not.toBeNull();

    act(() => result.current.autosave.resumeNodes(["node-a"]));
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => result.current.autosave.changeDraft("node-a", "delete me"));
    act(() => result.current.autosave.pauseNodes(["node-a"]));
    act(() => result.current.autosave.discardNodes(["node-a"]));
    expect(result.current.autosave.drafts["node-a"]).toBeUndefined();
    expect(localStorage.getItem(draftJournalKey("map-a", "node-a"))).toBeNull();
    expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("idle");
  });

  it("does not recreate content cache when a deleted node save resolves late", async () => {
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => response.promise));
    const { result, client } = renderAutosaveHook();

    act(() => result.current.autosave.changeDraft("node-a", "in flight"));
    act(() => { void result.current.autosave.flush("node-a"); });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    act(() => result.current.autosave.discardNodes(["node-a"]));

    await act(async () => {
      response.resolve(new Response(JSON.stringify({
        node: { ...serverContent.node, contentMd: "in flight", revision: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.coordinator.getRecord("node-a", "content").phase).toBe("idle");
    expect(client.getQueryData(nodeContentQueryKey("node-a"))).toBeUndefined();
  });
});

function renderAutosaveHook() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(nodeContentQueryKey("node-a"), serverContent);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => {
    const coordinator = useNodeMutationCoordinator([{ id: "node-a", revision: 0 }]);
    const autosave = useMarkdownAutosave({
      mindmapId: "map-a",
      selectedNodeId: "node-a",
      selectedContent: serverContent,
      coordinator,
    });
    return { coordinator, autosave };
  }, { wrapper });
  return { ...rendered, client };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
