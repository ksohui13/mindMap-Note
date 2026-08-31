"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/features/mindmap/api/client";
import {
  aggregateSaveRecords,
  idleSaveRecord,
  isRetryableSaveError,
  saveRecordKey,
  type SaveKind,
  type SaveRecord,
} from "@/features/mindmap/model/save-state";

type RevisionedResponse = { node: { revision: number } };
type RunOptions<T extends RevisionedResponse> = Readonly<{
  onSuccess?: (response: T) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  retry?: () => void;
}>;

export function useNodeMutationCoordinator(
  nodes: ReadonlyArray<Readonly<{ id: string; revision: number }>>,
) {
  const [records, setRecords] = useState<Readonly<Record<string, SaveRecord>>>({});
  const recordsRef = useRef<Readonly<Record<string, SaveRecord>>>({});
  const revisions = useRef(new Map<string, number>());
  const tails = useRef(new Map<string, Promise<unknown>>());
  const sequences = useRef(new Map<string, number>());
  const retries = useRef(new Map<string, () => void>());
  const forgottenNodes = useRef(new Set<string>());

  useEffect(() => {
    for (const node of nodes) {
      const current = revisions.current.get(node.id);
      if (current === undefined || node.revision > current) {
        revisions.current.set(node.id, node.revision);
      }
    }
  }, [nodes]);

  const setRecord = useCallback((nodeId: string, kind: SaveKind, record: SaveRecord) => {
    const key = saveRecordKey(nodeId, kind);
    const current = recordsRef.current;
    if (current[key] === record) return;
    const next = { ...current, [key]: record };
    recordsRef.current = next;
    setRecords(next);
  }, []);

  const supersede = useCallback((nodeId: string, kind: SaveKind) => {
    const key = saveRecordKey(nodeId, kind);
    const next = (sequences.current.get(key) ?? 0) + 1;
    sequences.current.set(key, next);
    return next;
  }, []);

  const run = useCallback<RunMutation>(async function runMutation(
    nodeId,
    kind,
    operation,
    options = {},
  ) {
    if (forgottenNodes.current.has(nodeId)) {
      throw new Error("Node is no longer available.");
    }
    const key = saveRecordKey(nodeId, kind);
    const sequence = supersede(nodeId, kind);
    setRecord(nodeId, kind, { phase: "saving" });
    retries.current.delete(key);

    const execute = async () => {
      try {
        const revision = revisions.current.get(nodeId);
        if (revision === undefined) throw new Error("Node revision is not available.");
        const response = await operation(revision);
        if (forgottenNodes.current.has(nodeId)) return response;
        revisions.current.set(nodeId, response.node.revision);
        await options.onSuccess?.(response);
        if (sequences.current.get(key) === sequence) {
          setRecord(nodeId, kind, { phase: "saved" });
        }
        return response;
      } catch (error) {
        if (forgottenNodes.current.has(nodeId)) throw error;
        if (error instanceof ApiClientError && error.status === 409) {
          const currentRevision = error.details?.currentRevision;
          if (Number.isInteger(currentRevision)) {
            revisions.current.set(nodeId, currentRevision as number);
          }
        }
        await options.onError?.(error);
        if (sequences.current.get(key) === sequence) {
          const canRetry = isRetryableSaveError(error) ||
            error instanceof ApiClientError && error.status === 409;
          if (canRetry) {
            const retry = options.retry ?? (() => {
              void runMutation(nodeId, kind, operation, options).catch(() => undefined);
            });
            retries.current.set(key, retry);
          }
          setRecord(nodeId, kind, {
            phase: "failed",
            error: error instanceof Error ? error.message : "저장하지 못했습니다.",
            retryable: canRetry,
          });
        }
        throw error;
      }
    };

    const previous = tails.current.get(nodeId) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(execute);
    const settledTask = task.then(() => undefined, () => undefined);
    const tail = settledTask.finally(() => {
      if (tails.current.get(nodeId) === tail) tails.current.delete(nodeId);
    });
    tails.current.set(nodeId, tail);
    return task;
  }, [setRecord, supersede]);

  const markDirty = useCallback((nodeId: string, kind: SaveKind) => {
    supersede(nodeId, kind);
    retries.current.delete(saveRecordKey(nodeId, kind));
    setRecord(nodeId, kind, { phase: "dirty" });
  }, [setRecord, supersede]);

  const markIdle = useCallback((nodeId: string, kind: SaveKind) => {
    supersede(nodeId, kind);
    retries.current.delete(saveRecordKey(nodeId, kind));
    setRecord(nodeId, kind, idleSaveRecord);
  }, [setRecord, supersede]);

  const registerRevision = useCallback((nodeId: string, revision: number) => {
    if (!Number.isInteger(revision) || revision < 0) return;
    revisions.current.set(nodeId, revision);
    forgottenNodes.current.delete(nodeId);
  }, []);

  const getRecord = useCallback((nodeId: string, kind: SaveKind) =>
    records[saveRecordKey(nodeId, kind)] ?? idleSaveRecord, [records]);

  const getCurrentRecord = useCallback((nodeId: string, kind: SaveKind) =>
    recordsRef.current[saveRecordKey(nodeId, kind)] ?? idleSaveRecord, []);

  const waitForNodes = useCallback(async (nodeIds: readonly string[]) => {
    const targets = new Set(nodeIds);
    while (true) {
      const pending = [...tails.current.entries()]
        .filter(([nodeId]) => targets.has(nodeId))
        .map(([, tail]) => tail);
      if (pending.length === 0) return;
      await Promise.all(pending);
    }
  }, []);

  const retry = useCallback((nodeId: string, kind: SaveKind) => {
    retries.current.get(saveRecordKey(nodeId, kind))?.();
  }, []);

  const retryAll = useCallback(() => {
    for (const action of [...retries.current.values()]) action();
  }, []);

  const forgetNodes = useCallback((nodeIds: readonly string[]) => {
    const forgotten = new Set(nodeIds);
    for (const nodeId of forgotten) {
      forgottenNodes.current.add(nodeId);
      revisions.current.delete(nodeId);
      for (const kind of ["title", "position", "collapse", "content"] as const) {
        supersede(nodeId, kind);
        retries.current.delete(saveRecordKey(nodeId, kind));
      }
    }
    const nextRecords = Object.fromEntries(
      Object.entries(recordsRef.current).filter(([key]) => {
        const separator = key.lastIndexOf(":");
        return separator < 0 || !forgotten.has(key.slice(0, separator));
      }),
    );
    recordsRef.current = nextRecords;
    setRecords(nextRecords);
  }, [supersede]);

  const overall = useMemo(() => aggregateSaveRecords(Object.values(records)), [records]);

  return {
    run,
    markDirty,
    markIdle,
    registerRevision,
    getRecord,
    getCurrentRecord,
    waitForNodes,
    retry,
    retryAll,
    forgetNodes,
    overall,
    records,
  };
}

type RunMutation = <T extends RevisionedResponse>(
  nodeId: string,
  kind: SaveKind,
  operation: (revision: number) => Promise<T>,
  options?: RunOptions<T>,
) => Promise<T>;
