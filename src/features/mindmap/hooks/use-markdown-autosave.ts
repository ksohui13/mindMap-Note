"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiClientError, fetchNodeContent } from "@/features/mindmap/api/client";
import type { NodeContentResponse } from "@/features/mindmap/api/contracts";
import {
  createDraftJournalEntry,
  readDraftJournal,
  removeDraftJournal,
  writeDraftJournal,
  type DraftJournalEntry,
} from "@/features/mindmap/lib/draft-journal";
import { useUpdateNodeContent } from "@/features/mindmap/hooks/use-node-content";
import { nodeContentQueryKey } from "@/features/mindmap/hooks/use-node-content";
import { mindmapDetailQueryKey } from "@/features/mindmap/hooks/use-mindmap-detail";
import type { useNodeMutationCoordinator } from "@/features/mindmap/hooks/use-node-mutation-coordinator";

const AUTOSAVE_DELAY_MS = 2_000;

type Coordinator = ReturnType<typeof useNodeMutationCoordinator>;

export function useMarkdownAutosave({
  mindmapId,
  selectedNodeId,
  selectedContent,
  coordinator,
}: {
  mindmapId: string;
  selectedNodeId: string | null;
  selectedContent: NodeContentResponse | undefined;
  coordinator: Coordinator;
}) {
  const queryClient = useQueryClient();
  const contentMutation = useUpdateNodeContent(mindmapId);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [recoveries, setRecoveries] = useState<Readonly<Record<string, DraftJournalEntry>>>({});
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  const recoveriesRef = useRef(recoveries);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastEditedAt = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const pendingFlush = useRef(new Set<string>());
  const flushRef = useRef<(nodeId: string, options?: FlushOptions) => Promise<void>>(
    () => Promise.resolve(),
  );

  const clearTimer = useCallback((nodeId: string) => {
    const timer = timers.current.get(nodeId);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(nodeId);
  }, []);

  const schedule = useCallback((nodeId: string, delay = AUTOSAVE_DELAY_MS) => {
    clearTimer(nodeId);
    timers.current.set(nodeId, setTimeout(() => {
      timers.current.delete(nodeId);
      void flushRef.current(nodeId);
    }, Math.max(0, delay)));
  }, [clearTimer]);

  const changeDraft = useCallback((nodeId: string, value: string) => {
    const server = queryClient.getQueryData<NodeContentResponse>(nodeContentQueryKey(nodeId));
    if (!server || recoveriesRef.current[nodeId]) return;
    setDrafts((current) => ({ ...current, [nodeId]: value }));
    draftsRef.current = { ...draftsRef.current, [nodeId]: value };
    lastEditedAt.current.set(nodeId, Date.now());
    coordinator.markDirty(nodeId, "content");

    const result = writeDraftJournal(
      getBrowserStorage(),
      createDraftJournalEntry(mindmapId, nodeId, value, server.node.revision),
    );
    setStorageWarning(result.ok ? null : result.error);
    schedule(nodeId);
  }, [coordinator, mindmapId, queryClient, schedule]);

  const flush = useCallback(async (nodeId: string, options: FlushOptions = {}) => {
    clearTimer(nodeId);
    if (recoveriesRef.current[nodeId]) return;
    const draft = draftsRef.current[nodeId];
    const server = queryClient.getQueryData<NodeContentResponse>(nodeContentQueryKey(nodeId));
    if (draft === undefined || !server) return;
    if (draft === server.node.contentMd) {
      removeDraftJournal(getBrowserStorage(), mindmapId, nodeId);
      setDrafts((current) => omitKey(current, nodeId));
      draftsRef.current = omitKey(draftsRef.current, nodeId);
      coordinator.markIdle(nodeId, "content");
      return;
    }
    if (inFlight.current.has(nodeId)) {
      pendingFlush.current.add(nodeId);
      return;
    }

    const submitted = draft;
    inFlight.current.add(nodeId);
    try {
      await coordinator.run(
        nodeId,
        "content",
        (revision) => contentMutation.mutateAsync({
          nodeId,
          input: { contentMd: submitted, revision },
          keepalive: options.keepalive,
        }),
        {
          onSuccess: () => {
            if (draftsRef.current[nodeId] !== submitted) {
              coordinator.markDirty(nodeId, "content");
              return;
            }
            if (!options.keepalive) {
              removeDraftJournal(getBrowserStorage(), mindmapId, nodeId);
            }
            setDrafts((current) => omitKey(current, nodeId));
            draftsRef.current = omitKey(draftsRef.current, nodeId);
          },
          onError: async (error) => {
            if (error instanceof ApiClientError && error.status === 409) {
              await Promise.allSettled([
                queryClient.fetchQuery({
                  queryKey: nodeContentQueryKey(nodeId),
                  queryFn: () => fetchNodeContent(nodeId),
                }),
                queryClient.invalidateQueries({ queryKey: mindmapDetailQueryKey(mindmapId) }),
              ]);
            }
          },
          retry: () => {
            void flushRef.current(nodeId).catch(() => undefined);
          },
        },
      );
    } catch {
      // Coordinator exposes the error and keeps the journal/draft for retry.
    } finally {
      inFlight.current.delete(nodeId);
      const shouldFlush = pendingFlush.current.delete(nodeId);
      const latest = draftsRef.current[nodeId];
      if (latest !== undefined && latest !== submitted) {
        const elapsed = Date.now() - (lastEditedAt.current.get(nodeId) ?? Date.now());
        if (shouldFlush && elapsed >= AUTOSAVE_DELAY_MS) {
          void flushRef.current(nodeId).catch(() => undefined);
        } else {
          schedule(nodeId, AUTOSAVE_DELAY_MS - elapsed);
        }
      }
    }
  }, [clearTimer, contentMutation, coordinator, mindmapId, queryClient, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const flushAll = useCallback((options: FlushOptions = {}) => {
    for (const nodeId of Object.keys(draftsRef.current)) {
      void flushRef.current(nodeId, options).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!selectedNodeId || !selectedContent || draftsRef.current[selectedNodeId] !== undefined) return;
    const journal = readDraftJournal(getBrowserStorage(), mindmapId, selectedNodeId);
    if (!journal) return;
    if (journal.contentMd === selectedContent.node.contentMd) {
      removeDraftJournal(getBrowserStorage(), mindmapId, selectedNodeId);
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRecoveries((current) => ({ ...current, [selectedNodeId]: journal }));
      recoveriesRef.current = { ...recoveriesRef.current, [selectedNodeId]: journal };
    });
    return () => {
      cancelled = true;
    };
  }, [mindmapId, selectedContent, selectedNodeId]);

  useEffect(() => {
    const activeTimers = timers.current;
    const flushForLifecycle = () => flushAll({ keepalive: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushForLifecycle();
    };
    window.addEventListener("pagehide", flushForLifecycle);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushForLifecycle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [flushAll]);

  const applyRecovery = useCallback((nodeId: string) => {
    const journal = recoveriesRef.current[nodeId];
    if (!journal) return;
    setRecoveries((current) => omitKey(current, nodeId));
    recoveriesRef.current = omitKey(recoveriesRef.current, nodeId);
    setDrafts((current) => ({ ...current, [nodeId]: journal.contentMd }));
    draftsRef.current = { ...draftsRef.current, [nodeId]: journal.contentMd };
    lastEditedAt.current.set(nodeId, Date.now());
    coordinator.markDirty(nodeId, "content");
    schedule(nodeId);
  }, [coordinator, schedule]);

  const discardRecovery = useCallback((nodeId: string) => {
    removeDraftJournal(getBrowserStorage(), mindmapId, nodeId);
    setRecoveries((current) => omitKey(current, nodeId));
    recoveriesRef.current = omitKey(recoveriesRef.current, nodeId);
    setDrafts((current) => omitKey(current, nodeId));
    draftsRef.current = omitKey(draftsRef.current, nodeId);
    coordinator.markIdle(nodeId, "content");
  }, [coordinator, mindmapId]);

  return {
    drafts,
    changeDraft,
    flush,
    flushAll,
    recovery: selectedNodeId ? recoveries[selectedNodeId] : undefined,
    applyRecovery,
    discardRecovery,
    storageWarning,
  };
}

type FlushOptions = Readonly<{ keepalive?: boolean }>;

function omitKey<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
