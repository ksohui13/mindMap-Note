"use client";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/features/mindmap/api/client";
import { useDeleteMindmap, useRenameMindmap } from "@/features/dashboard/hooks/use-mindmaps";
import { MindmapEdge } from "@/features/mindmap/components/mindmap-edge";
import { MindmapNode } from "@/features/mindmap/components/mindmap-node";
import {
  NodeDetailFullscreen,
  NodeDetailPanel,
} from "@/features/mindmap/components/node-detail";
import type { ExportScope, MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { ExportModal, type ExportPreparationResult } from "@/features/mindmap/components/export-modal";
import {
  useBatchUpdateNodePositions,
  useCreateNode,
  useUpdateNodeCollapse,
  useUpdateNodePosition,
  useUpdateNodeTitle,
} from "@/features/mindmap/hooks/use-node-mutations";
import { useMarkdownAutosave } from "@/features/mindmap/hooks/use-markdown-autosave";
import { mindmapDetailQueryKey, useMindmapDetail } from "@/features/mindmap/hooks/use-mindmap-detail";
import { useNodeContent } from "@/features/mindmap/hooks/use-node-content";
import {
  nodeDeletionImpactQueryKey,
  useDeleteNode,
  useNodeDeletionImpact,
} from "@/features/mindmap/hooks/use-node-deletion";
import { useNodeMutationCoordinator } from "@/features/mindmap/hooks/use-node-mutation-coordinator";
import {
  findUnresolvedExportDrafts,
  formatUnresolvedDraftMessage,
  getBrowserStorage,
} from "@/features/mindmap/lib/export-preflight";
import {
  toMindmapFlow,
  type MindmapFlowEdge,
  type MindmapFlowNode,
} from "@/features/mindmap/model/flow-adapter";
import {
  calculateChildPosition,
  calculateRevealedNodePositions,
} from "@/features/mindmap/model/node-position";
import {
  applyNodeViewOverrides,
  getDescendantIds,
  nodesWithChildren,
  selectVisibleNodes,
  type CollapseOverrides,
  type NodePosition,
  type PositionOverrides,
} from "@/features/mindmap/model/visible-tree";
import { SaveStatus } from "@/shared/ui/save-status";
import { DeleteConfirmModal } from "@/shared/ui/delete-confirm-modal";

const nodeTypes: NodeTypes = { mindmap: MindmapNode };
const edgeTypes: EdgeTypes = { mindmap: MindmapEdge };
const fitViewOptions = { padding: 0.25, minZoom: 0.25, maxZoom: 1.25 } as const;

type MindmapEditorProps = {
  mindmapId: string;
  initialData?: MindmapDetailResponse;
  initialRootSelection?: boolean;
};

export function MindmapEditor(props: MindmapEditorProps) {
  return (
    <ReactFlowProvider>
      <MindmapEditorContent {...props} />
    </ReactFlowProvider>
  );
}

function MindmapEditorContent({ mindmapId, initialData, initialRootSelection = false }: MindmapEditorProps) {
  const router = useRouter();
  const detail = useMindmapDetail(mindmapId, initialData);
  const queryClient = useQueryClient();
  const createNodeMutation = useCreateNode();
  const updateTitleMutation = useUpdateNodeTitle();
  const updatePositionMutation = useUpdateNodePosition();
  const updateCollapseMutation = useUpdateNodeCollapse();
  const batchPositionMutation = useBatchUpdateNodePositions();
  const createNode = createNodeMutation.mutateAsync;
  const updateNodeTitle = updateTitleMutation.mutateAsync;
  const updateNodePosition = updatePositionMutation.mutateAsync;
  const updateNodeCollapse = updateCollapseMutation.mutateAsync;
  const batchUpdatePositions = batchPositionMutation.mutateAsync;
  const renameMindmap = useRenameMindmap();
  const deleteMindmap = useDeleteMindmap();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailFullscreenOpen, setDetailFullscreenOpen] = useState(false);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [savingNodeIds, setSavingNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [creatingNodeIds, setCreatingNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [creationErrors, setCreationErrors] = useState<Readonly<Record<string, string>>>({});
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [collapseOverrides, setCollapseOverrides] = useState<CollapseOverrides>({});
  const [pendingNodeIds, setPendingNodeIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [mutationErrors, setMutationErrors] = useState<Readonly<Record<
    string,
    { kind: "position" | "collapse"; message: string }
  >>>({});
  const createLocks = useRef(new Set<string>());
  const placementReservations = useRef(new Map<string, NodePosition>());
  const pendingLayoutBatches = useRef(new Map<string, Readonly<Record<string, NodePosition>>>());
  const nodeLayoutBatch = useRef(new Map<string, string>());
  const layoutBatchLocks = useRef(new Set<string>());
  const pendingCreateInputs = useRef(new Map<string, Parameters<typeof createNodeMutation.mutateAsync>[0]>());
  const creationPromises = useRef(new Map<string, Promise<boolean>>());
  const nodeMutationLocks = useRef(new Set<string>());
  const titleCommitLocks = useRef(new Set<string>());
  const deleteInFlight = useRef(false);
  const deleteMindmapInFlight = useRef(false);
  const [deleteMindmapOpen, setDeleteMindmapOpen] = useState(false);
  const [deleteTargetNodeId, setDeleteTargetNodeId] = useState<string | null>(null);
  const [exportContext, setExportContext] = useState<Readonly<{
    defaultScope: ExportScope;
    node?: Readonly<{ id: string; title: string }>;
  }> | null>(null);

  const saveCoordinator = useNodeMutationCoordinator(detail.data?.nodes ?? []);
  const {
    markIdle: markNodeIdle,
    registerRevision,
    run: runNodeMutation,
    waitForNodes,
  } = saveCoordinator;
  const deleteNodeMutation = useDeleteNode();
  const deletionImpact = useNodeDeletionImpact(deleteTargetNodeId);
  const selectedContent = useNodeContent(
    detailPanelOpen && selectedNodeId ? selectedNodeId : null,
  );
  const markdownAutosave = useMarkdownAutosave({
    mindmapId,
    selectedNodeId: detailPanelOpen ? selectedNodeId : null,
    selectedContent: selectedContent.data,
    coordinator: saveCoordinator,
  });
  const { flush: flushMarkdown } = markdownAutosave;
  const refetchDetail = detail.refetch;

  const effectiveNodes = useMemo(
    () => applyNodeViewOverrides(
      detail.data?.nodes ?? [],
      positionOverrides,
      collapseOverrides,
    ),
    [collapseOverrides, detail.data?.nodes, positionOverrides],
  );
  const visibleNodes = useMemo(
    () => detail.data
      ? selectVisibleNodes(effectiveNodes, detail.data.rootNodeId)
      : [],
    [detail.data, effectiveNodes],
  );
  const visibleDetail = useMemo(
    () => detail.data ? { ...detail.data, nodes: visibleNodes } : undefined,
    [detail.data, visibleNodes],
  );
  const parentNodeIds = useMemo(
    () => nodesWithChildren(detail.data?.nodes ?? []),
    [detail.data?.nodes],
  );

  const setNodePending = useCallback((nodeId: string, pending: boolean) => {
    setPendingNodeIds((current) => {
      const next = new Set(current);
      if (pending) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
  }, []);

  const replaceCachedNode = useCallback((node: MindmapDetailResponse["nodes"][number]) => {
    queryClient.setQueryData<MindmapDetailResponse>(
      mindmapDetailQueryKey(mindmapId),
      (current) => current
        ? {
            ...current,
            nodes: current.nodes.map((candidate) =>
              candidate.id === node.id ? node : candidate,
            ),
          }
        : current,
    );
  }, [mindmapId, queryClient]);

  const clearMutationError = useCallback((nodeId: string) => {
    setMutationErrors((current) => {
      if (!current[nodeId]) return current;
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const startEdit = useCallback((nodeId: string) => {
    if (savingNodeIds.has(nodeId) || nodeMutationLocks.current.has(nodeId)) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditError(null);
  }, [detail.data, savingNodeIds]);

  const cancelEdit = useCallback(() => {
    if (editingNodeId && savingNodeIds.has(editingNodeId)) return;
    setEditingNodeId(null);
    setEditError(null);
  }, [editingNodeId, savingNodeIds]);

  const commitEdit = useCallback(async (nodeId: string, submittedTitle: string) => {
    if (
      editingNodeId !== nodeId ||
      titleCommitLocks.current.has(nodeId) ||
      nodeMutationLocks.current.has(nodeId)
    ) return;
    titleCommitLocks.current.add(nodeId);
    try {
      const creation = creationPromises.current.get(nodeId);
      if (creation && !(await creation)) {
        setEditError("노드 생성을 다시 시도한 뒤 제목을 저장해 주세요.");
        return;
      }
      const currentDetail = queryClient.getQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(mindmapId));
      const node = currentDetail?.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      const title = submittedTitle.trim();
      if (!title) {
        setEditError("노드 제목을 입력해 주세요.");
        return;
      }
      if (title === node.title) {
        setEditingNodeId(null);
        setEditError(null);
        return;
      }

      nodeMutationLocks.current.add(node.id);
      setSavingNodeIds((current) => new Set(current).add(node.id));
      setEditError(null);
      await runNodeMutation(
        node.id,
        "title",
        (revision) => updateNodeTitle({
          nodeId: node.id,
          input: { title, revision },
        }),
        {
          onSuccess: (response) => {
            queryClient.setQueryData<MindmapDetailResponse>(
              mindmapDetailQueryKey(mindmapId),
              (current) => current
                ? {
                    ...current,
                    nodes: current.nodes.map((candidate) =>
                      candidate.id === response.node.id ? response.node : candidate,
                    ),
                  }
                : current,
            );
            setEditingNodeId(null);
          },
          onError: async (error) => {
            if (error instanceof ApiClientError && error.status === 409) {
              await refetchDetail();
              setEditError("다른 변경사항을 반영했습니다. 다시 시도해 주세요.");
              return;
            }
            setEditError(error instanceof Error ? error.message : "제목을 저장하지 못했습니다.");
          },
        },
      );
    } catch {
      // The coordinator records the failed operation and exposes the retry action.
    } finally {
      titleCommitLocks.current.delete(nodeId);
      nodeMutationLocks.current.delete(nodeId);
      setSavingNodeIds((current) => {
        const next = new Set(current);
        next.delete(nodeId);
        return next;
      });
    }
  }, [editingNodeId, mindmapId, queryClient, refetchDetail, runNodeMutation, updateNodeTitle]);

  const persistOptimisticNode = useCallback((nodeId: string) => {
    const input = pendingCreateInputs.current.get(nodeId);
    if (!input || creationPromises.current.has(nodeId)) return;
    setCreatingNodeIds((current) => new Set(current).add(nodeId));
    setCreationErrors((current) => omitKey(current, nodeId));
    const task = createNode(input).then((response) => {
      replaceCachedNode(response.node);
      registerRevision(response.node.id, response.node.revision);
      pendingCreateInputs.current.delete(nodeId);
      placementReservations.current.delete(nodeId);
      return true;
    }).catch((error: unknown) => {
      setCreationErrors((current) => ({
        ...current,
        [nodeId]: error instanceof Error ? error.message : "하위 노드를 만들지 못했습니다.",
      }));
      return false;
    }).finally(() => {
      creationPromises.current.delete(nodeId);
      setCreatingNodeIds((current) => {
        const next = new Set(current);
        next.delete(nodeId);
        return next;
      });
    });
    creationPromises.current.set(nodeId, task);
  }, [createNode, registerRevision, replaceCachedNode]);

  const addChild = useCallback((parentNodeId: string) => {
    if (
      createLocks.current.has(parentNodeId) ||
      nodeMutationLocks.current.has(parentNodeId)
    ) return;
    const current = queryClient.getQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(mindmapId));
    if (!current) return;
    const latestNodes = applyNodeViewOverrides(
      current.nodes,
      positionOverrides,
      collapseOverrides,
    );
    const latestVisibleNodes = selectVisibleNodes(latestNodes, current.rootNodeId);
    const parent = latestVisibleNodes.find((node) => node.id === parentNodeId);
    if (!parent || parent.isCollapsed) return;

    createLocks.current.add(parentNodeId);
    const position = calculateChildPosition(
      parent,
      latestVisibleNodes,
      [...placementReservations.current.values()],
    );
    const nodeId = crypto.randomUUID();
    placementReservations.current.set(nodeId, position);
    const input = {
      mindmapId,
      input: { id: nodeId, parentNodeId, title: "새 노드", ...position },
    };
    pendingCreateInputs.current.set(nodeId, input);
    registerRevision(nodeId, 0);
    queryClient.setQueryData<MindmapDetailResponse>(
      mindmapDetailQueryKey(mindmapId),
      (cached) => cached
        ? {
            ...cached,
            nodes: [...cached.nodes, {
              id: nodeId,
              parentNodeId,
              title: "새 노드",
              ...position,
              isCollapsed: false,
              revision: 0,
            }],
          }
        : cached,
    );
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditError(null);
    createLocks.current.delete(parentNodeId);
    persistOptimisticNode(nodeId);
  }, [collapseOverrides, mindmapId, persistOptimisticNode, positionOverrides, queryClient, registerRevision]);

  const retryCreate = useCallback((nodeId: string) => {
    persistOptimisticNode(nodeId);
  }, [persistOptimisticNode]);

  const discardOptimisticNode = useCallback((nodeId: string) => {
    if (creationPromises.current.has(nodeId)) return;
    pendingCreateInputs.current.delete(nodeId);
    placementReservations.current.delete(nodeId);
    setCreationErrors((current) => omitKey(current, nodeId));
    queryClient.setQueryData<MindmapDetailResponse>(
      mindmapDetailQueryKey(mindmapId),
      (current) => current
        ? { ...current, nodes: current.nodes.filter((node) => node.id !== nodeId) }
        : current,
    );
    if (editingNodeId === nodeId) setEditingNodeId(null);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [editingNodeId, mindmapId, queryClient, selectedNodeId]);

  const persistPosition = useCallback(async (nodeId: string, position: NodePosition) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    if (!detail.data?.nodes.some((candidate) => candidate.id === nodeId)) return;

    nodeMutationLocks.current.add(nodeId);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      await runNodeMutation(
        nodeId,
        "position",
        (revision) => updateNodePosition({
          nodeId,
          input: { ...position, revision },
        }),
        {
          onSuccess: (response) => {
            replaceCachedNode(response.node);
            setPositionOverrides((current) => {
              const next = { ...current };
              delete next[nodeId];
              return next;
            });
          },
          onError: async (error) => {
            const isConflict = error instanceof ApiClientError && error.status === 409;
            if (isConflict) await refetchDetail();
            setMutationErrors((current) => ({
              ...current,
              [nodeId]: {
                kind: "position",
                message: isConflict
                  ? "다른 변경사항을 반영했습니다. 위치 저장을 다시 시도해 주세요."
                  : error instanceof Error ? error.message : "위치를 저장하지 못했습니다.",
              },
            }));
          },
        },
      );
    } catch {
      // The local override remains available for retry or restore.
    } finally {
      nodeMutationLocks.current.delete(nodeId);
      setNodePending(nodeId, false);
    }
  }, [clearMutationError, detail.data?.nodes, refetchDetail, replaceCachedNode, runNodeMutation, setNodePending, updateNodePosition]);

  const persistCollapse = useCallback(async (nodeId: string, isCollapsed: boolean) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    if (!detail.data?.nodes.some((candidate) => candidate.id === nodeId)) return;

    nodeMutationLocks.current.add(nodeId);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      await runNodeMutation(
        nodeId,
        "collapse",
        (revision) => updateNodeCollapse({
          nodeId,
          input: { isCollapsed, revision },
        }),
        {
          onSuccess: (response) => {
            replaceCachedNode(response.node);
            setCollapseOverrides((current) => {
              const next = { ...current };
              delete next[nodeId];
              return next;
            });
          },
          onError: async (error) => {
            const isConflict = error instanceof ApiClientError && error.status === 409;
            if (isConflict) await refetchDetail();
            setMutationErrors((current) => ({
              ...current,
              [nodeId]: {
                kind: "collapse",
                message: isConflict
                  ? "다른 변경사항을 반영했습니다. 접기 상태 저장을 다시 시도해 주세요."
                  : error instanceof Error ? error.message : "접기 상태를 저장하지 못했습니다.",
              },
            }));
          },
        },
      );
    } catch {
      // The local override remains available for retry or restore.
    } finally {
      nodeMutationLocks.current.delete(nodeId);
      setNodePending(nodeId, false);
    }
  }, [clearMutationError, detail.data?.nodes, refetchDetail, replaceCachedNode, runNodeMutation, setNodePending, updateNodeCollapse]);

  const persistLayoutBatch = useCallback(async (
    batchId: string,
    positions: Readonly<Record<string, NodePosition>>,
  ) => {
    if (layoutBatchLocks.current.has(batchId)) return;
    const nodeIds = Object.keys(positions);
    if (nodeIds.length === 0) return;
    layoutBatchLocks.current.add(batchId);
    for (const nodeId of nodeIds) setNodePending(nodeId, true);
    setMutationErrors((current) => omitNodeKeys(current, new Set(nodeIds)));

    try {
      await waitForNodes(nodeIds);
      const current = queryClient.getQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(mindmapId));
      if (!current) throw new Error("마인드맵 정보를 불러오지 못했습니다.");
      const byId = new Map(current.nodes.map((node) => [node.id, node]));
      const inputNodes = nodeIds.map((nodeId) => {
        const node = byId.get(nodeId);
        if (!node) throw new Error("자동 배치할 노드를 찾지 못했습니다.");
        return { id: nodeId, ...positions[nodeId], revision: node.revision };
      });
      const response = await batchUpdatePositions({
        mindmapId,
        input: { nodes: inputNodes },
      });
      const updatedById = new Map(response.nodes.map((node) => [node.id, node]));
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (cached) => cached
          ? {
              ...cached,
              mindmap: { ...cached.mindmap, updatedAt: response.mindmapUpdatedAt },
              nodes: cached.nodes.map((node) => updatedById.get(node.id) ?? node),
            }
          : cached,
      );
      for (const node of response.nodes) registerRevision(node.id, node.revision);
      const nodeIdSet = new Set(nodeIds);
      setPositionOverrides((currentOverrides) => omitNodeKeys(currentOverrides, nodeIdSet));
      setMutationErrors((currentErrors) => omitNodeKeys(currentErrors, nodeIdSet));
      pendingLayoutBatches.current.delete(batchId);
      for (const nodeId of nodeIds) nodeLayoutBatch.current.delete(nodeId);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        await refetchDetail();
      }
      setMutationErrors((current) => ({
        ...current,
        ...Object.fromEntries(nodeIds.map((nodeId) => [nodeId, {
          kind: "position" as const,
          message: error instanceof ApiClientError && error.status === 409
            ? "다른 변경사항을 반영했습니다. 자동 배치를 다시 시도해 주세요."
            : error instanceof Error ? error.message : "자동 배치를 저장하지 못했습니다.",
        }])),
      }));
    } finally {
      layoutBatchLocks.current.delete(batchId);
      for (const nodeId of nodeIds) setNodePending(nodeId, false);
    }
  }, [batchUpdatePositions, mindmapId, queryClient, refetchDetail, registerRevision, setNodePending, waitForNodes]);

  const changeNodePositions = useCallback((changes: NodeChange<MindmapFlowNode>[]) => {
    if (!changes.some((change) => change.type === "position" && change.position)) return;
    setPositionOverrides((current) => {
      const next = { ...current };
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          next[change.id] = change.position;
        }
      }
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    if (nodeMutationLocks.current.has(nodeId) || !parentNodeIds.has(nodeId)) return;
    const node = effectiveNodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const nextCollapsed = !node.isCollapsed;
    if (!nextCollapsed && detail.data) {
      const visibleBefore = selectVisibleNodes(effectiveNodes, detail.data.rootNodeId);
      const visibleBeforeIds = new Set(visibleBefore.map((candidate) => candidate.id));
      const expandedNodes = effectiveNodes.map((candidate) => candidate.id === nodeId
        ? { ...candidate, isCollapsed: false }
        : candidate);
      const revealedNodeIds = new Set(
        selectVisibleNodes(expandedNodes, detail.data.rootNodeId)
          .map((candidate) => candidate.id)
          .filter((candidateId) => !visibleBeforeIds.has(candidateId)),
      );
      const positions = calculateRevealedNodePositions(
        expandedNodes,
        visibleBeforeIds,
        revealedNodeIds,
      );
      if (Object.keys(positions).length > 0) {
        const batchId = `expand:${nodeId}`;
        pendingLayoutBatches.current.set(batchId, positions);
        for (const revealedNodeId of Object.keys(positions)) {
          nodeLayoutBatch.current.set(revealedNodeId, batchId);
        }
        setPositionOverrides((current) => ({ ...current, ...positions }));
        void persistLayoutBatch(batchId, positions);
      }
    }
    setCollapseOverrides((current) => ({ ...current, [nodeId]: nextCollapsed }));
    clearMutationError(nodeId);

    if (nextCollapsed && detail.data) {
      const descendants = getDescendantIds(detail.data.nodes, nodeId);
      if (selectedNodeId && descendants.has(selectedNodeId)) {
        if (detailPanelOpen) void flushMarkdown(selectedNodeId);
        setSelectedNodeId(nodeId);
      }
      if (editingNodeId && descendants.has(editingNodeId)) {
        setEditingNodeId(null);
        setEditError(null);
      }
    }
    void persistCollapse(nodeId, nextCollapsed);
  }, [clearMutationError, detail.data, detailPanelOpen, editingNodeId, effectiveNodes, flushMarkdown, parentNodeIds, persistCollapse, persistLayoutBatch, selectedNodeId]);

  const retryNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
      const batchId = nodeLayoutBatch.current.get(nodeId);
      const positions = batchId ? pendingLayoutBatches.current.get(batchId) : undefined;
      if (batchId && positions) {
        void persistLayoutBatch(batchId, positions);
        return;
      }
      const position = positionOverrides[nodeId];
      if (position) void persistPosition(nodeId, position);
      return;
    }
    const isCollapsed = collapseOverrides[nodeId];
    if (isCollapsed !== undefined) void persistCollapse(nodeId, isCollapsed);
  }, [collapseOverrides, mutationErrors, persistCollapse, persistLayoutBatch, persistPosition, positionOverrides]);

  const revertNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
      const batchId = nodeLayoutBatch.current.get(nodeId);
      const positions = batchId ? pendingLayoutBatches.current.get(batchId) : undefined;
      if (batchId && positions) {
        const batchNodeIds = Object.keys(positions);
        const batchNodeIdSet = new Set(batchNodeIds);
        setPositionOverrides((current) => omitNodeKeys(current, batchNodeIdSet));
        setMutationErrors((current) => omitNodeKeys(current, batchNodeIdSet));
        pendingLayoutBatches.current.delete(batchId);
        for (const batchNodeId of batchNodeIds) {
          nodeLayoutBatch.current.delete(batchNodeId);
          markNodeIdle(batchNodeId, "position");
        }
        return;
      }
      setPositionOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    } else {
      setCollapseOverrides((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    }
    clearMutationError(nodeId);
    markNodeIdle(nodeId, error.kind);
  }, [clearMutationError, markNodeIdle, mutationErrors]);

  const openNodeDetail = useCallback((nodeId: string) => {
    if (selectedNodeId && selectedNodeId !== nodeId) {
      void flushMarkdown(selectedNodeId);
    }
    setSelectedNodeId(nodeId);
    setDetailFullscreenOpen(false);
    setDetailPanelOpen(true);
  }, [flushMarkdown, selectedNodeId]);

  const closeNodeDetail = useCallback(() => {
    if (selectedNodeId) void flushMarkdown(selectedNodeId);
    setDetailFullscreenOpen(false);
    setDetailPanelOpen(false);
  }, [flushMarkdown, selectedNodeId]);

  const closeFullscreen = useCallback(() => {
    setDetailFullscreenOpen(false);
    queueMicrotask(() => fullscreenButtonRef.current?.focus());
  }, []);

  const selectCanvasNode = useCallback((nodeId: string | null) => {
    if (nodeId) {
      setSelectedNodeId(nodeId);
      return;
    }
    setSelectedNodeId(null);
    closeNodeDetail();
  }, [closeNodeDetail]);

  const deleteTargetIds = useMemo(() => {
    if (!deleteTargetNodeId || !detail.data) return [];
    return [
      deleteTargetNodeId,
      ...getDescendantIds(detail.data.nodes, deleteTargetNodeId),
    ];
  }, [deleteTargetNodeId, detail.data]);

  const openDeleteNode = useCallback((nodeId: string) => {
    if (nodeId === detail.data?.rootNodeId) return;
    deleteNodeMutation.reset();
    setDeleteTargetNodeId(nodeId);
  }, [deleteNodeMutation, detail.data?.rootNodeId]);

  const openHeaderExport = useCallback(() => {
    const selected = selectedNodeId
      ? detail.data?.nodes.find((node) => node.id === selectedNodeId)
      : undefined;
    setExportContext({
      defaultScope: "ALL",
      node: selected ? { id: selected.id, title: selected.title } : undefined,
    });
  }, [detail.data?.nodes, selectedNodeId]);

  const openNodeExport = useCallback((nodeId: string) => {
    const node = detail.data?.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setExportContext({
      defaultScope: "SUBTREE",
      node: { id: node.id, title: node.title },
    });
  }, [detail.data?.nodes]);

  const prepareExport = useCallback(async (scope: ExportScope): Promise<ExportPreparationResult> => {
    if (!detail.data) return { ok: false, message: "마인드맵을 불러온 뒤 다시 시도해 주세요." };
    const targetNodeId = exportContext?.node?.id;
    if (scope !== "ALL" && !targetNodeId) {
      return { ok: false, message: "내보낼 기준 노드를 선택해 주세요." };
    }
    const targetIds = scope === "ALL"
      ? detail.data.nodes.map((node) => node.id)
      : scope === "NODE"
        ? [targetNodeId as string]
        : [targetNodeId as string, ...getDescendantIds(detail.data.nodes, targetNodeId as string)];
    const saved = await markdownAutosave.prepareExport(targetIds);
    if (!saved.ok) return saved;

    const targetSet = new Set(targetIds);
    const unresolved = await findUnresolvedExportDrafts({
      storage: getBrowserStorage(),
      mindmapId,
      nodeIds: targetSet,
    });
    return unresolved.length === 0
      ? { ok: true }
      : {
          ok: false,
          message: formatUnresolvedDraftMessage(unresolved.map((draft) => draft.title)),
        };
  }, [detail.data, exportContext?.node?.id, markdownAutosave, mindmapId]);

  const confirmDeleteNode = useCallback(async () => {
    if (
      deleteInFlight.current ||
      !deleteTargetNodeId ||
      !deletionImpact.data ||
      deleteTargetIds.length === 0
    ) return;
    deleteInFlight.current = true;
    markdownAutosave.pauseNodes(deleteTargetIds);
    const deletedIds = new Set(deleteTargetIds);

    try {
      const response = await deleteNodeMutation.mutateAsync({
        nodeId: deleteTargetNodeId,
        input: { expectedDeleteCount: deletionImpact.data.totalDeleteCount },
      });
      markdownAutosave.discardNodes(deleteTargetIds);
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (current) => current
          ? {
              ...current,
              mindmap: { ...current.mindmap, updatedAt: response.mindmapUpdatedAt },
              nodes: current.nodes.filter((node) => !deletedIds.has(node.id)),
            }
          : current,
      );
      for (const nodeId of deleteTargetIds) {
        queryClient.removeQueries({ queryKey: nodeDeletionImpactQueryKey(nodeId), exact: true });
        createLocks.current.delete(nodeId);
        nodeMutationLocks.current.delete(nodeId);
        placementReservations.current.delete(nodeId);
        const batchId = nodeLayoutBatch.current.get(nodeId);
        nodeLayoutBatch.current.delete(nodeId);
        if (batchId) pendingLayoutBatches.current.delete(batchId);
      }
      setPositionOverrides((current) => omitNodeKeys(current, deletedIds));
      setCollapseOverrides((current) => omitNodeKeys(current, deletedIds));
      setMutationErrors((current) => omitNodeKeys(current, deletedIds));
      setPendingNodeIds((current) => new Set([...current].filter((id) => !deletedIds.has(id))));
      if (editingNodeId && deletedIds.has(editingNodeId)) {
        setEditingNodeId(null);
        setEditError(null);
      }
      if (selectedNodeId && deletedIds.has(selectedNodeId)) {
        setSelectedNodeId(null);
        setDetailFullscreenOpen(false);
        setDetailPanelOpen(false);
      }
      setDeleteTargetNodeId(null);
    } catch (error) {
      markdownAutosave.resumeNodes(deleteTargetIds);
      if (error instanceof ApiClientError && error.status === 409) {
        await deletionImpact.refetch();
      }
    } finally {
      deleteInFlight.current = false;
    }
  }, [deleteNodeMutation, deleteTargetIds, deleteTargetNodeId, deletionImpact, editingNodeId, markdownAutosave, mindmapId, queryClient, selectedNodeId]);

  const confirmDeleteMindmap = useCallback(async () => {
    if (deleteMindmapInFlight.current || !detail.data) return;
    deleteMindmapInFlight.current = true;
    try {
      await deleteMindmap.mutateAsync({
        id: mindmapId,
        expectedNodeCount: detail.data.nodes.length,
      });
      router.replace("/");
    } catch {
      // The confirmation dialog keeps the actionable error visible.
    } finally {
      deleteMindmapInFlight.current = false;
    }
  }, [deleteMindmap, detail.data, mindmapId, router]);

  if (detail.isPending && !detail.data) return <EditorLoadingState />;
  if (!detail.data) {
    return <EditorQueryError onRetry={() => void detail.refetch()} />;
  }

  return (
    <main className="flex h-screen min-h-[32rem] flex-col overflow-hidden bg-[var(--background)]">
      <EditorHeader
        title={detail.data.mindmap.title}
        refreshFailed={detail.isError}
        onRetry={() => void detail.refetch()}
        saveRecord={saveCoordinator.overall}
        onRetrySave={saveCoordinator.retryAll}
        onBeforeNavigate={() => markdownAutosave.flushAll()}
        onExport={openHeaderExport}
        renamePending={renameMindmap.isPending}
        renameError={renameMindmap.isError ? renameMindmap.error.message : null}
        onRename={async (title) => {
          await renameMindmap.mutateAsync({ id: mindmapId, title });
        }}
        onDelete={() => {
          deleteMindmap.reset();
          setDeleteMindmapOpen(true);
        }}
      />
      <MindmapCanvas
        detail={visibleDetail ?? detail.data}
        selectedNodeId={selectedNodeId}
        onSelectNode={selectCanvasNode}
        onOpenDetail={openNodeDetail}
        editingNodeId={editingNodeId}
        editError={editError}
        savingNodeIds={savingNodeIds}
        creatingNodeIds={creatingNodeIds}
        creationErrors={creationErrors}
        pendingNodeIds={pendingNodeIds}
        parentNodeIds={parentNodeIds}
        mutationErrors={mutationErrors}
        onAddChild={addChild}
        onCancelEdit={cancelEdit}
        onCommitEdit={commitEdit}
        onStartEdit={startEdit}
        onToggleCollapse={toggleCollapse}
        onDelete={openDeleteNode}
        onExport={openNodeExport}
        onRetryMutation={retryNodeMutation}
        onRevertMutation={revertNodeMutation}
        onRetryCreate={retryCreate}
        onDiscardCreate={discardOptimisticNode}
        onNodesChange={changeNodePositions}
        onNodeDragStop={persistPosition}
      />
      {detailPanelOpen && selectedNodeId ? (
        <NodeDetailPanel
          nodeId={selectedNodeId}
          title={detail.data.nodes.find((node) => node.id === selectedNodeId)?.title ?? "노드 상세"}
          content={selectedContent}
          draft={markdownAutosave.drafts[selectedNodeId]}
          onChangeDraft={markdownAutosave.changeDraft}
          onClose={closeNodeDetail}
          onOpenFullscreen={() => setDetailFullscreenOpen(true)}
          fullscreenButtonRef={fullscreenButtonRef}
          saveRecord={saveCoordinator.getRecord(selectedNodeId, "content")}
          onRetrySave={() => saveCoordinator.retry(selectedNodeId, "content")}
          onSave={() => void markdownAutosave.flush(selectedNodeId)}
          recovery={markdownAutosave.recovery}
          onApplyRecovery={() => markdownAutosave.applyRecovery(selectedNodeId)}
          onDiscardRecovery={() => markdownAutosave.discardRecovery(selectedNodeId)}
          storageWarning={markdownAutosave.storageWarning}
        />
      ) : null}
      {detailFullscreenOpen && selectedNodeId ? (
        <NodeDetailFullscreen
          nodeId={selectedNodeId}
          title={detail.data.nodes.find((node) => node.id === selectedNodeId)?.title ?? "노드 상세"}
          content={selectedContent}
          draft={markdownAutosave.drafts[selectedNodeId]}
          onChangeDraft={markdownAutosave.changeDraft}
          onClose={closeFullscreen}
          saveRecord={saveCoordinator.getRecord(selectedNodeId, "content")}
          onRetrySave={() => saveCoordinator.retry(selectedNodeId, "content")}
          onSave={() => void markdownAutosave.flush(selectedNodeId)}
          recovery={markdownAutosave.recovery}
          onApplyRecovery={() => markdownAutosave.applyRecovery(selectedNodeId)}
          onDiscardRecovery={() => markdownAutosave.discardRecovery(selectedNodeId)}
          storageWarning={markdownAutosave.storageWarning}
        />
      ) : null}
      <DeleteConfirmModal
        open={deleteMindmapOpen}
        title={`'${detail.data.mindmap.title}' 마인드맵을 삭제하시겠습니까?`}
        description={`마인드맵과 포함된 노드 ${detail.data.nodes.length}개가 모두 삭제됩니다.`}
        pending={deleteMindmap.isPending}
        error={deleteMindmap.isError ? deleteMindmap.error.message || "마인드맵을 삭제하지 못했습니다." : null}
        onOpenChange={(open) => {
          setDeleteMindmapOpen(open);
          if (!open) deleteMindmap.reset();
        }}
        onConfirm={() => void confirmDeleteMindmap()}
      />
      <DeleteConfirmModal
        open={deleteTargetNodeId !== null}
        title={`'${deletionImpact.data?.node.title ?? "노드"}' 노드를 삭제하시겠습니까?`}
        description={deletionImpact.isPending || deletionImpact.isFetching
          ? "삭제 영향을 확인하고 있습니다."
          : deletionImpact.data?.descendantCount
            ? `하위 개념 ${deletionImpact.data.descendantCount}개도 함께 삭제됩니다.`
            : "이 노드만 삭제됩니다."}
        pending={deleteNodeMutation.isPending}
        confirmDisabled={!deletionImpact.data || deletionImpact.isFetching}
        error={deletionImpact.isError
          ? "삭제 영향을 불러오지 못했습니다."
          : deleteNodeMutation.isError
            ? deleteNodeMutation.error.message || "노드를 삭제하지 못했습니다."
            : null}
        onRetry={deletionImpact.isError
          ? () => void deletionImpact.refetch()
          : undefined}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetNodeId(null);
            deleteNodeMutation.reset();
          }
        }}
        onConfirm={() => void confirmDeleteNode()}
      />
      {exportContext ? (
        <ExportModal
          open
          mindmapId={mindmapId}
          mindmapTitle={detail.data.mindmap.title}
          node={exportContext.node}
          defaultScope={exportContext.defaultScope}
          prepareExport={prepareExport}
          onOpenChange={(open) => {
            if (!open) setExportContext(null);
          }}
        />
      ) : null}
    </main>
  );
}

function EditorHeader({
  title,
  refreshFailed,
  onRetry,
  saveRecord,
  onRetrySave,
  onBeforeNavigate,
  onExport,
  renamePending,
  renameError,
  onRename,
  onDelete,
}: {
  title: string;
  refreshFailed: boolean;
  onRetry: () => void;
  saveRecord: ReturnType<typeof useNodeMutationCoordinator>["overall"];
  onRetrySave: () => void;
  onBeforeNavigate: () => void;
  onExport: () => void;
  renamePending: boolean;
  renameError: string | null;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [localError, setLocalError] = useState<string | null>(null);
  const cancelOnBlur = useRef(false);
  const renameInFlight = useRef(false);

  async function commitRename() {
    if (renameInFlight.current) return;
    if (cancelOnBlur.current) {
      cancelOnBlur.current = false;
      return;
    }
    const normalized = draft.trim();
    if (!normalized) {
      setLocalError("마인드맵 제목을 입력해 주세요.");
      return;
    }
    if (normalized === title) {
      setEditing(false);
      setLocalError(null);
      return;
    }
    renameInFlight.current = true;
    try {
      await onRename(normalized);
      setEditing(false);
      setLocalError(null);
    } catch {
      // The mutation error is rendered next to the input and the draft is preserved.
    } finally {
      renameInFlight.current = false;
    }
  }

  return (
    <header className="z-10 border-b border-[var(--border)] bg-white">
      <div className="flex min-h-[4.5rem] items-center gap-4 px-4 sm:px-6">
        <Link href="/" onClick={onBeforeNavigate} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]">← Dashboard</Link>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              aria-label="마인드맵 제목"
              value={draft}
              readOnly={renamePending}
              maxLength={200}
              onChange={(event) => {
                setDraft(event.target.value);
                setLocalError(null);
              }}
              onBlur={() => void commitRename()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  cancelOnBlur.current = true;
                  setDraft(title);
                  setEditing(false);
                  setLocalError(null);
                }
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void commitRename();
                }
              }}
              className="w-full rounded-lg border border-[var(--primary)] px-3 py-2 text-lg font-extrabold outline-none"
            />
          ) : (
            <h1 className="truncate text-lg font-extrabold">{title}</h1>
          )}
          {localError || renameError ? <p role="alert" className="mt-1 text-xs font-bold text-[var(--danger)]">{localError ?? renameError}</p> : null}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(title);
              setLocalError(null);
              setEditing(true);
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)]"
          >
            제목 수정
          </button>
        ) : null}
        <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-[var(--danger)] hover:bg-red-50">삭제</button>
        <SaveStatus record={saveRecord} onRetry={onRetrySave} />
        {refreshFailed ? (
          <button type="button" onClick={onRetry} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-[var(--danger)]">새로고침 실패 · 다시 시도</button>
        ) : null}
        <button type="button" onClick={onExport} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]">
          내보내기
        </button>
      </div>
    </header>
  );
}

const MindmapCanvas = memo(function MindmapCanvas({
  detail,
  selectedNodeId,
  onSelectNode,
  onOpenDetail,
  editingNodeId,
  editError,
  savingNodeIds,
  creatingNodeIds,
  creationErrors,
  pendingNodeIds,
  parentNodeIds,
  mutationErrors,
  onAddChild,
  onCancelEdit,
  onCommitEdit,
  onStartEdit,
  onToggleCollapse,
  onDelete,
  onExport,
  onRetryMutation,
  onRevertMutation,
  onRetryCreate,
  onDiscardCreate,
  onNodesChange,
  onNodeDragStop,
}: {
  detail: MindmapDetailResponse;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenDetail: (nodeId: string) => void;
  editingNodeId: string | null;
  editError: string | null;
  savingNodeIds: ReadonlySet<string>;
  creatingNodeIds: ReadonlySet<string>;
  creationErrors: Readonly<Record<string, string>>;
  pendingNodeIds: ReadonlySet<string>;
  parentNodeIds: ReadonlySet<string>;
  mutationErrors: Readonly<Record<string, { kind: "position" | "collapse"; message: string }>>;
  onAddChild: (nodeId: string) => void;
  onCancelEdit: () => void;
  onCommitEdit: (nodeId: string, title: string) => void;
  onStartEdit: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onExport: (nodeId: string) => void;
  onRetryMutation: (nodeId: string) => void;
  onRevertMutation: (nodeId: string) => void;
  onRetryCreate: (nodeId: string) => void;
  onDiscardCreate: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<MindmapFlowNode>[]) => void;
  onNodeDragStop: (nodeId: string, position: NodePosition) => void;
}) {
  const flow = useMemo(
    () => toMindmapFlow(detail, selectedNodeId, {
      editingNodeId,
      editError,
      savingNodeIds,
      creatingNodeIds,
      childCreateError: null,
      creationErrors,
      pendingNodeIds,
      nodesWithChildren: parentNodeIds,
      mutationErrors,
      onAddChild,
      onOpenDetail,
      onCancelEdit,
      onCommitEdit,
      onStartEdit,
      onToggleCollapse,
      onDelete,
      onExport,
      onRetryMutation,
      onRevertMutation,
      onRetryCreate,
      onDiscardCreate,
    }),
    [
      creationErrors,
      mutationErrors,
      onRetryMutation,
      onRevertMutation,
      onToggleCollapse,
      onDelete,
      onExport,
      parentNodeIds,
      pendingNodeIds,
      creatingNodeIds,
      detail,
      editError,
      editingNodeId,
      onAddChild,
      onOpenDetail,
      onCancelEdit,
      onCommitEdit,
      onStartEdit,
      onRetryCreate,
      onDiscardCreate,
      savingNodeIds,
      selectedNodeId,
    ],
  );
  const selectNode = useCallback((_event: React.MouseEvent, node: MindmapFlowNode) => onSelectNode(node.id), [onSelectNode]);
  const clearSelection = useCallback(() => onSelectNode(null), [onSelectNode]);

  return (
    <section
      aria-label="마인드맵 캔버스"
      data-nodes-draggable="true"
      data-nodes-connectable="false"
      data-delete-enabled="false"
      className="relative min-h-0 flex-1"
    >
      <ReactFlow<MindmapFlowNode, MindmapFlowEdge>
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={selectNode}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_event, node) => onNodeDragStop(node.id, node.position)}
        onPaneClick={clearSelection}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        onlyRenderVisibleElements={process.env.NODE_ENV !== "test"}
        elementsSelectable
        edgesFocusable={false}
        deleteKeyCode={null}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbc7df" />
        <CanvasToolbar />
      </ReactFlow>
    </section>
  );
});

function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow<MindmapFlowNode, MindmapFlowEdge>();
  return (
    <Panel position="bottom-left" className="!m-4 flex overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
      <button type="button" aria-label="확대" onClick={() => void zoomIn({ duration: 160 })} className="grid size-10 place-items-center border-r border-[var(--border)] text-lg font-bold hover:bg-violet-50">+</button>
      <button type="button" aria-label="축소" onClick={() => void zoomOut({ duration: 160 })} className="grid size-10 place-items-center border-r border-[var(--border)] text-lg font-bold hover:bg-violet-50">−</button>
      <button type="button" aria-label="화면 맞춤" onClick={() => void fitView({ ...fitViewOptions, duration: 240 })} className="px-3 text-xs font-bold hover:bg-violet-50">맞춤</button>
    </Panel>
  );
}

function EditorLoadingState() {
  return <div aria-label="마인드맵 불러오는 중" className="h-screen animate-pulse bg-gradient-to-br from-violet-50 to-[var(--background)]" />;
}

function EditorQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-extrabold">마인드맵을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">잠시 후 다시 시도하거나 Dashboard로 돌아가세요.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold">Dashboard</Link>
          <button type="button" onClick={onRetry} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white">다시 시도</button>
        </div>
      </div>
    </main>
  );
}

function omitNodeKeys<T>(
  record: Readonly<Record<string, T>>,
  nodeIds: ReadonlySet<string>,
): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([nodeId]) => !nodeIds.has(nodeId)),
  );
}

function omitKey<T>(
  record: Readonly<Record<string, T>>,
  key: string,
): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}
