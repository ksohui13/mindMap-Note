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
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/features/mindmap/api/client";
import { MindmapEdge } from "@/features/mindmap/components/mindmap-edge";
import { MindmapNode } from "@/features/mindmap/components/mindmap-node";
import {
  NodeDetailFullscreen,
  NodeDetailPanel,
} from "@/features/mindmap/components/node-detail";
import type { ExportScope, MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { ExportModal, type ExportPreparationResult } from "@/features/mindmap/components/export-modal";
import {
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
import { calculateChildPosition } from "@/features/mindmap/model/node-position";
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
  const detail = useMindmapDetail(mindmapId, initialData);
  const queryClient = useQueryClient();
  const createNodeMutation = useCreateNode();
  const updateTitleMutation = useUpdateNodeTitle();
  const updatePositionMutation = useUpdateNodePosition();
  const updateCollapseMutation = useUpdateNodeCollapse();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailFullscreenOpen, setDetailFullscreenOpen] = useState(false);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(
    initialRootSelection && initialData ? initialData.rootNodeId : null,
  );
  const [editDraft, setEditDraft] = useState(
    initialRootSelection && initialData
      ? initialData.nodes.find((node) => node.id === initialData.rootNodeId)?.title ?? ""
      : "",
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [childCreateError, setChildCreateError] = useState<{
    parentNodeId: string;
    message: string;
  } | null>(null);
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
  const nodeMutationLocks = useRef(new Set<string>());
  const deleteInFlight = useRef(false);
  const [deleteTargetNodeId, setDeleteTargetNodeId] = useState<string | null>(null);
  const [exportContext, setExportContext] = useState<Readonly<{
    defaultScope: ExportScope;
    node?: Readonly<{ id: string; title: string }>;
  }> | null>(null);

  const saveCoordinator = useNodeMutationCoordinator(detail.data?.nodes ?? []);
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
    if (savingNodeId || creatingParentId || nodeMutationLocks.current.has(nodeId)) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditDraft(node.title);
    setEditError(null);
  }, [creatingParentId, detail.data, savingNodeId]);

  const cancelEdit = useCallback(() => {
    if (savingNodeId === editingNodeId) return;
    setEditingNodeId(null);
    setEditDraft("");
    setEditError(null);
  }, [editingNodeId, savingNodeId]);

  const commitEdit = useCallback(async () => {
    if (
      !editingNodeId ||
      nodeMutationLocks.current.has(editingNodeId)
    ) return;
    const node = detail.data?.nodes.find((candidate) => candidate.id === editingNodeId);
    if (!node) return;
    const title = editDraft.trim();
    if (!title) {
      setEditDraft(node.title);
      setEditError("노드 제목을 입력해 주세요.");
      return;
    }
    if (title === node.title) {
      setEditingNodeId(null);
      setEditDraft("");
      setEditError(null);
      return;
    }

    nodeMutationLocks.current.add(node.id);
    setSavingNodeId(node.id);
    setEditError(null);

    try {
      await saveCoordinator.run(
        node.id,
        "title",
        (revision) => updateTitleMutation.mutateAsync({
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
            setEditDraft("");
          },
          onError: async (error) => {
            if (error instanceof ApiClientError && error.status === 409) {
              await detail.refetch();
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
      nodeMutationLocks.current.delete(node.id);
      setSavingNodeId(null);
    }
  }, [detail, editDraft, editingNodeId, mindmapId, queryClient, saveCoordinator, updateTitleMutation]);

  const addChild = useCallback(async (parentNodeId: string) => {
    if (
      savingNodeId ||
      creatingParentId ||
      createLocks.current.has(parentNodeId) ||
      nodeMutationLocks.current.has(parentNodeId)
    ) return;
    const current = detail.data;
    const parent = effectiveNodes.find((node) => node.id === parentNodeId);
    if (!current || !parent || parent.isCollapsed) return;

    createLocks.current.add(parentNodeId);
    setCreatingParentId(parentNodeId);
    setChildCreateError(null);
    const position = calculateChildPosition(parent, effectiveNodes);

    try {
      const response = await createNodeMutation.mutateAsync({
        mindmapId,
        input: {
          parentNodeId,
          title: "새 노드",
          ...position,
        },
      });
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (cached) => cached
          ? {
              ...cached,
              mindmap: { ...cached.mindmap, updatedAt: response.mindmapUpdatedAt },
              nodes: [...cached.nodes, response.node],
            }
          : cached,
      );
      setSelectedNodeId(response.node.id);
      setEditingNodeId(response.node.id);
      setEditDraft(response.node.title);
      setEditError(null);
    } catch (error) {
      setChildCreateError({
        parentNodeId,
        message: error instanceof Error ? error.message : "자식 노드를 만들지 못했습니다.",
      });
    } finally {
      createLocks.current.delete(parentNodeId);
      setCreatingParentId((currentParentId) =>
        currentParentId === parentNodeId ? null : currentParentId,
      );
    }
  }, [createNodeMutation, creatingParentId, detail.data, effectiveNodes, mindmapId, queryClient, savingNodeId]);

  const persistPosition = useCallback(async (nodeId: string, position: NodePosition) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    if (!detail.data?.nodes.some((candidate) => candidate.id === nodeId)) return;

    nodeMutationLocks.current.add(nodeId);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      await saveCoordinator.run(
        nodeId,
        "position",
        (revision) => updatePositionMutation.mutateAsync({
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
            if (isConflict) await detail.refetch();
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
  }, [clearMutationError, detail, replaceCachedNode, saveCoordinator, setNodePending, updatePositionMutation]);

  const persistCollapse = useCallback(async (nodeId: string, isCollapsed: boolean) => {
    if (nodeMutationLocks.current.has(nodeId)) return;
    if (!detail.data?.nodes.some((candidate) => candidate.id === nodeId)) return;

    nodeMutationLocks.current.add(nodeId);
    setNodePending(nodeId, true);
    clearMutationError(nodeId);

    try {
      await saveCoordinator.run(
        nodeId,
        "collapse",
        (revision) => updateCollapseMutation.mutateAsync({
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
            if (isConflict) await detail.refetch();
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
  }, [clearMutationError, detail, replaceCachedNode, saveCoordinator, setNodePending, updateCollapseMutation]);

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
    setCollapseOverrides((current) => ({ ...current, [nodeId]: nextCollapsed }));
    clearMutationError(nodeId);

    if (nextCollapsed && detail.data) {
      const descendants = getDescendantIds(detail.data.nodes, nodeId);
      if (selectedNodeId && descendants.has(selectedNodeId)) {
        if (detailPanelOpen) void markdownAutosave.flush(selectedNodeId);
        setSelectedNodeId(nodeId);
      }
      if (editingNodeId && descendants.has(editingNodeId)) {
        setEditingNodeId(null);
        setEditDraft("");
        setEditError(null);
      }
    }
    void persistCollapse(nodeId, nextCollapsed);
  }, [clearMutationError, detail.data, detailPanelOpen, editingNodeId, effectiveNodes, markdownAutosave, parentNodeIds, persistCollapse, selectedNodeId]);

  const retryNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
      const position = positionOverrides[nodeId];
      if (position) void persistPosition(nodeId, position);
      return;
    }
    const isCollapsed = collapseOverrides[nodeId];
    if (isCollapsed !== undefined) void persistCollapse(nodeId, isCollapsed);
  }, [collapseOverrides, mutationErrors, persistCollapse, persistPosition, positionOverrides]);

  const revertNodeMutation = useCallback((nodeId: string) => {
    const error = mutationErrors[nodeId];
    if (!error) return;
    if (error.kind === "position") {
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
    saveCoordinator.markIdle(nodeId, error.kind);
  }, [clearMutationError, mutationErrors, saveCoordinator]);

  const openNodeDetail = useCallback((nodeId: string) => {
    if (selectedNodeId && selectedNodeId !== nodeId) {
      void markdownAutosave.flush(selectedNodeId);
    }
    setSelectedNodeId(nodeId);
    setDetailPanelOpen(true);
  }, [markdownAutosave, selectedNodeId]);

  const closeNodeDetail = useCallback(() => {
    if (selectedNodeId) void markdownAutosave.flush(selectedNodeId);
    setDetailFullscreenOpen(false);
    setDetailPanelOpen(false);
  }, [markdownAutosave, selectedNodeId]);

  const closeFullscreen = useCallback(() => {
    setDetailFullscreenOpen(false);
    queueMicrotask(() => fullscreenButtonRef.current?.focus());
  }, []);

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
      }
      setPositionOverrides((current) => omitNodeKeys(current, deletedIds));
      setCollapseOverrides((current) => omitNodeKeys(current, deletedIds));
      setMutationErrors((current) => omitNodeKeys(current, deletedIds));
      setPendingNodeIds((current) => new Set([...current].filter((id) => !deletedIds.has(id))));
      if (childCreateError && deletedIds.has(childCreateError.parentNodeId)) {
        setChildCreateError(null);
      }
      if (editingNodeId && deletedIds.has(editingNodeId)) {
        setEditingNodeId(null);
        setEditDraft("");
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
  }, [childCreateError, deleteNodeMutation, deleteTargetIds, deleteTargetNodeId, deletionImpact, editingNodeId, markdownAutosave, mindmapId, queryClient, selectedNodeId]);

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
      />
      <MindmapCanvas
        detail={{ ...detail.data, nodes: visibleNodes }}
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId) => {
          if (nodeId) openNodeDetail(nodeId);
          else {
            setSelectedNodeId(null);
            closeNodeDetail();
          }
        }}
        onOpenDetail={openNodeDetail}
        editingNodeId={editingNodeId}
        editDraft={editDraft}
        editError={editError}
        savingNodeId={savingNodeId}
        creatingParentId={creatingParentId}
        childCreateError={childCreateError}
        pendingNodeIds={pendingNodeIds}
        parentNodeIds={parentNodeIds}
        mutationErrors={mutationErrors}
        onAddChild={(nodeId) => void addChild(nodeId)}
        onCancelEdit={cancelEdit}
        onChangeDraft={(value) => {
          setEditDraft(value);
          setEditError(null);
        }}
        onCommitEdit={() => void commitEdit()}
        onStartEdit={startEdit}
        onToggleCollapse={toggleCollapse}
        onDelete={openDeleteNode}
        onExport={openNodeExport}
        onRetryMutation={retryNodeMutation}
        onRevertMutation={revertNodeMutation}
        onNodesChange={changeNodePositions}
        onNodeDragStop={(nodeId, position) => void persistPosition(nodeId, position)}
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
          recovery={markdownAutosave.recovery}
          onApplyRecovery={() => markdownAutosave.applyRecovery(selectedNodeId)}
          onDiscardRecovery={() => markdownAutosave.discardRecovery(selectedNodeId)}
          storageWarning={markdownAutosave.storageWarning}
        />
      ) : null}
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
}: {
  title: string;
  refreshFailed: boolean;
  onRetry: () => void;
  saveRecord: ReturnType<typeof useNodeMutationCoordinator>["overall"];
  onRetrySave: () => void;
  onBeforeNavigate: () => void;
  onExport: () => void;
}) {
  return (
    <header className="z-10 border-b border-[var(--border)] bg-white">
      <div className="flex min-h-[4.5rem] items-center gap-4 px-4 sm:px-6">
        <Link href="/" onClick={onBeforeNavigate} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold hover:border-[var(--primary)] hover:text-[var(--primary)]">← Dashboard</Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>
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

function MindmapCanvas({
  detail,
  selectedNodeId,
  onSelectNode,
  onOpenDetail,
  editingNodeId,
  editDraft,
  editError,
  savingNodeId,
  creatingParentId,
  childCreateError,
  pendingNodeIds,
  parentNodeIds,
  mutationErrors,
  onAddChild,
  onCancelEdit,
  onChangeDraft,
  onCommitEdit,
  onStartEdit,
  onToggleCollapse,
  onDelete,
  onExport,
  onRetryMutation,
  onRevertMutation,
  onNodesChange,
  onNodeDragStop,
}: {
  detail: MindmapDetailResponse;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenDetail: (nodeId: string) => void;
  editingNodeId: string | null;
  editDraft: string;
  editError: string | null;
  savingNodeId: string | null;
  creatingParentId: string | null;
  childCreateError: { parentNodeId: string; message: string } | null;
  pendingNodeIds: ReadonlySet<string>;
  parentNodeIds: ReadonlySet<string>;
  mutationErrors: Readonly<Record<string, { kind: "position" | "collapse"; message: string }>>;
  onAddChild: (nodeId: string) => void;
  onCancelEdit: () => void;
  onChangeDraft: (value: string) => void;
  onCommitEdit: () => void;
  onStartEdit: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onExport: (nodeId: string) => void;
  onRetryMutation: (nodeId: string) => void;
  onRevertMutation: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<MindmapFlowNode>[]) => void;
  onNodeDragStop: (nodeId: string, position: NodePosition) => void;
}) {
  const flow = useMemo(
    () => toMindmapFlow(detail, selectedNodeId, {
      editingNodeId,
      editDraft,
      editError,
      savingNodeId,
      creatingParentId,
      childCreateError,
      pendingNodeIds,
      nodesWithChildren: parentNodeIds,
      mutationErrors,
      onAddChild,
      onOpenDetail,
      onCancelEdit,
      onChangeDraft,
      onCommitEdit,
      onStartEdit,
      onToggleCollapse,
      onDelete,
      onExport,
      onRetryMutation,
      onRevertMutation,
    }),
    [
      childCreateError,
      mutationErrors,
      onRetryMutation,
      onRevertMutation,
      onToggleCollapse,
      onDelete,
      onExport,
      parentNodeIds,
      pendingNodeIds,
      creatingParentId,
      detail,
      editDraft,
      editError,
      editingNodeId,
      onAddChild,
      onOpenDetail,
      onCancelEdit,
      onChangeDraft,
      onCommitEdit,
      onStartEdit,
      savingNodeId,
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
}

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
