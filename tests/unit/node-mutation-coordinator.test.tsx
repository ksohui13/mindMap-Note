import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/features/mindmap/api/client";
import { useNodeMutationCoordinator } from "@/features/mindmap/hooks/use-node-mutation-coordinator";

describe("node mutation coordinator", () => {
  it("serializes the same node while allowing different nodes in parallel", async () => {
    const { result } = renderHook(() => useNodeMutationCoordinator([
      { id: "a", revision: 0 },
      { id: "b", revision: 0 },
    ]));
    const first = deferred<{ node: { revision: number } }>();
    const secondOperation = vi.fn(async (revision: number) => ({ node: { revision: revision + 1 } }));
    const otherOperation = vi.fn(async (revision: number) => ({ node: { revision: revision + 1 } }));

    let firstRequest!: Promise<{ node: { revision: number } }>;
    let secondRequest!: Promise<{ node: { revision: number } }>;
    let otherRequest!: Promise<{ node: { revision: number } }>;
    act(() => {
      firstRequest = result.current.run("a", "title", () => first.promise);
      secondRequest = result.current.run("a", "position", secondOperation);
      otherRequest = result.current.run("b", "collapse", otherOperation);
    });

    await waitFor(() => expect(otherOperation).toHaveBeenCalledWith(0));
    expect(secondOperation).not.toHaveBeenCalled();
    first.resolve({ node: { revision: 1 } });
    await firstRequest;
    await secondRequest;
    await otherRequest;
    expect(secondOperation).toHaveBeenCalledWith(1);
  });

  it("does not let an old response overwrite a newer dirty state", async () => {
    const { result } = renderHook(() => useNodeMutationCoordinator([{ id: "a", revision: 0 }]));
    const request = deferred<{ node: { revision: number } }>();
    let save!: Promise<{ node: { revision: number } }>;

    act(() => {
      save = result.current.run("a", "content", () => request.promise);
    });
    act(() => result.current.markDirty("a", "content"));
    request.resolve({ node: { revision: 1 } });
    await save;

    expect(result.current.getRecord("a", "content").phase).toBe("dirty");
  });

  it("uses the server revision from a conflict for explicit retry", async () => {
    const { result } = renderHook(() => useNodeMutationCoordinator([{ id: "a", revision: 2 }]));
    const operation = vi.fn()
      .mockRejectedValueOnce(new ApiClientError(
        "conflict",
        "CONFLICT",
        409,
        { currentRevision: 7 },
      ))
      .mockImplementationOnce(async (revision: number) => ({ node: { revision: revision + 1 } }));

    await act(async () => {
      await result.current.run("a", "content", operation).catch(() => undefined);
    });
    expect(result.current.getRecord("a", "content")).toMatchObject({
      phase: "failed",
      retryable: true,
    });

    act(() => result.current.retry("a", "content"));
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(2));
    expect(operation.mock.calls[1]?.[0]).toBe(7);
    await waitFor(() => expect(result.current.getRecord("a", "content").phase).toBe("saved"));
  });

  it("forgets deleted nodes and ignores a late mutation response", async () => {
    const { result } = renderHook(() => useNodeMutationCoordinator([{ id: "a", revision: 0 }]));
    const request = deferred<{ node: { revision: number } }>();
    const onSuccess = vi.fn();
    let save!: Promise<{ node: { revision: number } }>;

    act(() => {
      save = result.current.run("a", "content", () => request.promise, { onSuccess });
    });
    act(() => result.current.forgetNodes(["a"]));
    expect(result.current.getRecord("a", "content").phase).toBe("idle");

    request.resolve({ node: { revision: 1 } });
    await act(async () => { await save; });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.getRecord("a", "content").phase).toBe("idle");
    await expect(result.current.run("a", "title", async () => ({ node: { revision: 2 } })))
      .rejects.toThrow("Node is no longer available");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
